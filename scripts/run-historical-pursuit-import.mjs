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
  const result = { mode: null, envFile: ".env.local", workbook: null, manifest: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--rehearse" || value === "--apply") result.mode = value.slice(2);
    else if (value === "--env-file") { result.envFile = argv[++index]; }
    else if (value === "--manifest") { result.manifest = argv[++index]; }
    else if (!value.startsWith("--") && !result.workbook) result.workbook = value;
    else throw new Error(`Unknown or repeated option: ${value}`);
  }
  if (!result.workbook || !result.mode) throw new Error("Usage: node scripts/run-historical-pursuit-import.mjs <workbook.xlsx> --rehearse|--apply [--env-file .env.local]");
  if (result.mode === "apply" && !result.manifest) throw new Error("--apply requires an approved --manifest file.");
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
function approvalDigest(record, fingerprint) { return crypto.createHash("sha256").update(JSON.stringify({ fingerprint, buyerId: record.buyer?.id ?? null, opportunityId: record.opportunity?.id ?? null, blockers: record.blockers, flags: record.reviewFlags })).digest("hex"); }
try {
  await client.connect();
  const manifest = reconcileHistoricalPursuits(parsed, await snapshot(client));
  if (config.manifest) {
    const approved = JSON.parse(fs.readFileSync(config.manifest, "utf8"));
    if (approved.source?.sha256 !== parsed.source.sha256 || approved.manifestDigest !== manifestDigest || JSON.stringify(approved.records) !== JSON.stringify(manifest.records)) throw new Error("Approved manifest does not bind this exact workbook and live resolution.");
  }
  await client.query("BEGIN");
  if (config.mode === "rehearse") {
    await client.query(fs.readFileSync(path.join(directory, "112_historical_pursuit_ledger.sql"), "utf8"));
  } else {
    const exists = await client.query("SELECT to_regprocedure('public.apply_historical_pursuit_import_row(text,text,integer,uuid,uuid,text[],text[],text,boolean,text,text,text,text,text,text,text[],text[],jsonb,text)') AS fn");
    if (!exists.rows[0]?.fn) throw new Error("Reviewed migration 112 must be applied before --apply.");
  }
  for (const record of manifest.records) {
    const row = parsed.rows.find((item) => item.sourceRow === record.sourceRow);
    await client.query("SELECT public.stage_historical_pursuit_import_allowlist($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [parsed.source.sha256, parsed.source.sheet, record.sourceRow, manifestDigest, approvalDigest(record, rowFingerprint(row)), rowFingerprint(row), record.buyer?.id ?? null, record.opportunity?.id ?? null, record.blockers, record.reviewFlags]);
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
        sourceRow.opportunityReference, rowFingerprint(sourceRow), manifestDigest, record.blockers, record.reviewFlags, sourceRow.sourceCells, approvalDigest(record, rowFingerprint(sourceRow))],
    );
    return result.rows[0].result;
  }
  const results = [];
  for (const record of manifest.records) results.push(await invoke(record));
  if (config.mode === "rehearse") {
    const audit = await client.query(`SELECT count(*)::int AS rows, count(*) FILTER (WHERE match_id IS NOT NULL)::int AS linked, count(*) FILTER (WHERE match_id IS NULL)::int AS unlinked, count(*) FILTER (WHERE apply_outcome='created')::int AS created, count(*) FILTER (WHERE apply_outcome='merged')::int AS merged, count(*) FILTER (WHERE source_terminal)::int AS terminal, count(*) FILTER (WHERE apply_outcome='created' AND mapped_match_status NOT IN ('draft','dropped'))::int AS unsafe_created FROM public.historical_pursuit_import_rows`);
    const proof = audit.rows[0];
    if (proof.rows !== 60 || proof.linked !== 46 || proof.unlinked !== 14 || proof.created !== 33 || proof.merged !== 13 || proof.terminal !== 27 || proof.unsafe_created !== 0) throw new Error(`Historical pursuit rehearsal assertion failed: ${JSON.stringify(proof)}`);
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
