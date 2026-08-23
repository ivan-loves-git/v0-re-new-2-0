#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { reconcileHistoricalPursuits } from "./historical-pursuit-manifest.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const ACTOR = "W-112 historical pursuit import";

function options(argv) {
  const result = { mode: null, envFile: ".env.local", workbook: null, manifest: null, prepareManifest: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--rehearse" || value === "--apply") result.mode = value.slice(2);
    else if (value === "--env-file") { result.envFile = argv[++index]; }
    else if (value === "--manifest") { result.manifest = argv[++index]; }
    else if (value === "--prepare-manifest") { result.mode = "prepare"; result.prepareManifest = argv[++index]; }
    else if (!value.startsWith("--") && !result.workbook) result.workbook = value;
    else throw new Error(`Unknown or repeated option: ${value}`);
  }
  if (!result.workbook || !result.mode) throw new Error("Usage: node scripts/run-historical-pursuit-import.mjs <workbook.xlsx> --rehearse|--apply [--env-file .env.local]");
  if (result.mode === "apply" && !result.manifest) throw new Error("--apply requires an approved --manifest file.");
  if (result.mode === "prepare" && !result.prepareManifest) throw new Error("--prepare-manifest requires a new output path.");
  return result;
}

function environment(file) {
  return Object.fromEntries(fs.readFileSync(file, "utf8").split(/\r?\n/)
    .map((line) => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/)).filter(Boolean)
    .map((match) => [match[1], (match[2] ?? match[3] ?? match[4] ?? "").trim()]));
}

function source(workbook) {
  return JSON.parse(execFileSync("python3", [path.join(directory, "parse-historical-pursuit-workbook.py"), workbook], { encoding: "utf8" }));
}

async function snapshot(client) {
  const [repreneurs, opportunities, matches] = await Promise.all([
    client.query("SELECT id, first_name, last_name FROM public.repreneurs ORDER BY id"),
    client.query("SELECT id, reference FROM public.opportunities ORDER BY id"),
    client.query("SELECT opportunity_id, repreneur_id FROM public.opportunity_matches ORDER BY opportunity_id, repreneur_id"),
  ]);
  return { repreneurs: repreneurs.rows, opportunities: opportunities.rows, matches: matches.rows };
}

const config = options(process.argv.slice(2));
const env = environment(config.envFile);
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for this staff-only runner.");
const client = new pg.Client({ connectionString: env.DATABASE_URL });
const parsed = source(config.workbook);
const manifestDigest = crypto.createHash("sha256").update(JSON.stringify(parsed.rows)).digest("hex");
if (manifestDigest !== "b25008e1dfcc7c9e8f21f0f2aad5d757e54ed508243a89595fd5e231feb907b7") {
  throw new Error("Historical pursuit parser manifest digest mismatch.");
}
function rowFingerprint(row) { return crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"); }
function lengthPrefixed(value) { return value == null ? "-1:" : `${Buffer.byteLength(value, "utf8")}:${value}`; }
function canonicalFields(fields) { return fields.map(([key, value]) => `${lengthPrefixed(key)}${lengthPrefixed(value)}`).join(""); }
function sourcePayloadDigest(row) {
  const cells = row.sourceCells;
  return crypto.createHash("sha256").update(canonicalFields([
    ["repreneur_name", row.repreneurName], ["offer_label", row.offerLabel], ["opportunity_reference", row.opportunityReference],
    ["completed_source_stages", JSON.stringify(row.completedSourceStages)], ["not_applicable_source_stages", JSON.stringify(row.notApplicableSourceStages)], ["raw_drop_reason", row.dropReason],
    ["source_cells.interest_confirmed", cells.interest_confirmed], ["source_cells.nda_received", cells.nda_received], ["source_cells.nda_signed", cells.nda_signed],
    ["source_cells.info_memo_received", cells.info_memo_received], ["source_cells.qa_with_ma_firm", cells.qa_with_ma_firm], ["source_cells.seller_meeting", cells.seller_meeting],
    ["source_cells.valuation", cells.valuation], ["source_cells.loi_issued", cells.loi_issued], ["source_cells.audits", cells.audits], ["source_cells.financing", cells.financing], ["source_cells.closing", cells.closing],
  ])).digest("hex");
}
function approvalDigest(record, fingerprint, payloadDigest) {
  return crypto.createHash("sha256").update(canonicalFields([
    ["fingerprint", fingerprint], ["source_payload_digest", payloadDigest], ["repreneur", record.buyer?.id ?? null],
    ["opportunity", record.opportunity?.id ?? null], ["blockers", JSON.stringify(record.blockers)], ["flags", JSON.stringify(record.reviewFlags)],
  ])).digest("hex");
}
try {
  await client.connect();
  const manifest = reconcileHistoricalPursuits(parsed, await snapshot(client));
  if (config.mode === "prepare") {
    fs.writeFileSync(config.prepareManifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    process.stdout.write(`${JSON.stringify({ mode: "prepare", source: parsed.source, manifest: manifest.summary, proposed: manifest.safeApplySummary })}\n`);
    await client.end();
    process.exit(0);
  }
  if (config.manifest) {
    const approved = JSON.parse(fs.readFileSync(config.manifest, "utf8"));
    if (approved.source?.sha256 !== parsed.source.sha256 || approved.manifestDigest !== manifestDigest || JSON.stringify(approved.records) !== JSON.stringify(manifest.records)) throw new Error("Approved manifest does not bind this exact workbook and live resolution.");
  }
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '3s'");
  await client.query("SET LOCAL statement_timeout = '30s'");
  if (config.mode === "rehearse") {
    await client.query(fs.readFileSync(path.join(directory, "112_historical_pursuit_ledger.sql"), "utf8"));
  } else {
    const exists = await client.query("SELECT to_regprocedure('public.apply_historical_pursuit_import_row(text,text,integer,uuid,uuid,text[],text[],text,boolean,text,text,text,text,text,text,text[],text[],jsonb,text)') AS fn");
    if (!exists.rows[0]?.fn) throw new Error("Reviewed migration 112 must be applied before --apply.");
  }
  async function invoke(record) {
    if (!record.buyer && record.opportunity) throw new Error(`Source row ${record.sourceRow} has no exact repreneur.`);
    const sourceRow = parsed.rows.find((row) => row.sourceRow === record.sourceRow);
    if (!sourceRow) throw new Error(`Parser row ${record.sourceRow} was not found.`);
    const result = await client.query(
      "SELECT public.apply_historical_pursuit_import_row($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) AS result",
      [parsed.source.sha256, parsed.source.sheet, record.sourceRow, record.buyer?.id ?? null, record.opportunity?.id ?? null,
        record.historicalProposal.completedSourceStages, record.historicalProposal.notApplicableSourceStages,
        record.historicalProposal.dropReason, true, ACTOR, sourceRow.repreneurName, sourceRow.offerLabel,
        sourceRow.opportunityReference, rowFingerprint(sourceRow), manifestDigest, record.blockers, record.reviewFlags, sourceRow.sourceCells, approvalDigest(record, rowFingerprint(sourceRow), sourcePayloadDigest(sourceRow))],
    );
    return result.rows[0].result;
  }
  const results = [];
  for (const record of manifest.records) results.push(await invoke(record));
  if (config.mode === "rehearse") {
    const audit = await client.query(`SELECT count(*)::int AS rows, count(*) FILTER (WHERE match_id IS NOT NULL)::int AS linked, count(*) FILTER (WHERE match_id IS NULL)::int AS unlinked, count(*) FILTER (WHERE source_terminal)::int AS terminal, count(*) FILTER (WHERE source_terminal AND match_id IS NOT NULL)::int AS linked_terminal, count(*) FILTER (WHERE source_terminal AND match_id IS NULL)::int AS unlinked_terminal, count(*) FILTER (WHERE apply_outcome='created' AND mapped_match_status='dropped')::int AS created_dropped, count(*) FILTER (WHERE apply_outcome='created' AND mapped_match_status='draft')::int AS created_draft, count(*) FILTER (WHERE apply_outcome='merged' AND mapped_match_status='dropped')::int AS merged_dropped, count(*) FILTER (WHERE apply_outcome='merged' AND mapped_match_status='draft')::int AS merged_draft, count(*) FILTER (WHERE apply_outcome='merged' AND mapped_match_status='interested')::int AS merged_interested FROM public.historical_pursuit_import_rows`);
    const proof = audit.rows[0];
    if (proof.rows !== 60 || proof.linked !== 46 || proof.unlinked !== 14 || proof.terminal !== 35 || proof.linked_terminal !== 27 || proof.unlinked_terminal !== 8 || proof.created_dropped !== 23 || proof.created_draft !== 10 || proof.merged_dropped !== 4 || proof.merged_draft !== 8 || proof.merged_interested !== 1) throw new Error(`Historical pursuit rehearsal assertion failed: ${JSON.stringify(proof)}`);
    const staffRead = await client.query("SELECT count(*)::int AS rows FROM public.historical_pursuit_import_rows_for_staff(NULL)");
    if (staffRead.rows[0].rows !== 60) throw new Error("Staff historical pursuit projection mismatch.");
    const replay = [];
    for (const record of manifest.records) replay.push(await invoke(record));
    if (replay.some((item) => item.outcome !== "replay")) throw new Error("Historical pursuit replay changed a source row.");
    const postReplay = await client.query("SELECT count(*)::int AS rows FROM public.historical_pursuit_import_rows");
    if (postReplay.rows[0].rows !== 60) throw new Error("Historical pursuit replay changed ledger row count.");
  }
  if (config.mode === "rehearse") await client.query("ROLLBACK");
  else await client.query("COMMIT");
  const outcomes = results.reduce((counts, item) => ({ ...counts, [item.outcome]: (counts[item.outcome] ?? 0) + 1 }), {});
  process.stdout.write(`${JSON.stringify({ mode: config.mode, source: parsed.source, manifest: manifest.summary, proposed: manifest.safeApplySummary, outcomes })}\n`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { /* no transaction */ }
  throw error;
} finally { await client.end(); }
