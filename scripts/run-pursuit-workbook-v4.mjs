#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { reconcilePursuitWorkbookV4, sha256, v4ApplyRows, V4_SOURCE_SHA, V4_PRISTINE_MATCH_SQL } from "./pursuit-workbook-v4.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const [mode, workbook, envFile, manifestPath, actor, approvedDigest, ...extra] = process.argv.slice(2);
if (!["--prepare", "--check", "--apply"].includes(mode) || !workbook || !envFile || !manifestPath || extra.length
  || (mode === "--apply" && (!actor || !approvedDigest)) || (mode !== "--apply" && (actor || approvedDigest))) {
  throw new Error("Usage: node scripts/run-pursuit-workbook-v4.mjs --prepare|--check|--apply workbook.xlsx env-file private-manifest.json [staff-user-id approved-manifest-sha256]");
}
const env = Object.fromEntries(fs.readFileSync(envFile, "utf8").split(/\r?\n/)
  .map((line) => line.match(/^([^#=\s]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/)).filter(Boolean)
  .map((match) => [match[1], match[2] ?? match[3] ?? match[4] ?? ""]));
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required in the approved local source.");
const url = new URL(env.DATABASE_URL);
if (url.hostname !== "db.iiuqcdnmxhtyispnykgf.supabase.co" && !(url.hostname.endsWith(".pooler.supabase.com") && url.username === "postgres.iiuqcdnmxhtyispnykgf")) throw new Error("This operator is restricted to the approved WAVE production database.");
const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
const source = JSON.parse(execFileSync("python3", [path.join(directory, "parse-pursuit-workbook-v4.py"), workbook], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));

async function snapshot() {
  const repreneurs = await client.query("SELECT id,first_name,last_name,is_demo FROM public.repreneurs ORDER BY id");
  const opportunities = await client.query("SELECT id,reference,status,is_demo FROM public.opportunities ORDER BY id");
  const matches = await client.query(`SELECT m.id,m.opportunity_id,m.repreneur_id,m.status,
    encode(sha256(convert_to(to_jsonb(m)::TEXT,'UTF8')),'hex') AS fingerprint,
    (${V4_PRISTINE_MATCH_SQL}) AS pristine,
    to_jsonb(m) AS before_image FROM public.opportunity_matches m ORDER BY m.opportunity_id,m.repreneur_id`);
  return { repreneurs: repreneurs.rows, opportunities: opportunities.rows, matches: matches.rows };
}

try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout='30s'");
  const current = await snapshot();
  const prior = await client.query("SELECT count(*)::INTEGER AS count FROM public.historical_pursuit_import_rows WHERE source_sha256=$1", [V4_SOURCE_SHA]);
  const appliedRows = prior.rows[0].count;
  if (appliedRows !== 0 && appliedRows !== 72) throw new Error("Live state contains an incomplete V4 ledger; stop for review.");
  if (appliedRows && mode === "--prepare") throw new Error("Live state already contains the applied V4 source; use --check with the original manifest.");
  const manifest = reconcilePursuitWorkbookV4(source, current);
  const rows = v4ApplyRows(manifest, source);
  // Check the cross-language digests against the real, released SQL helper.
  for (const row of rows) {
    const result = await client.query("SELECT public.historical_pursuit_import_source_payload_digest($1,$2,$3,$4,$5,$6,$7) AS digest",
      [row.repreneurName,row.offerLabel,row.opportunityReference,row.completedSourceStages,row.notApplicableSourceStages,row.dropReason,row.sourceCells]);
    if (result.rows[0].digest !== row.payloadDigest) throw new Error(`Source digest disagreement at row ${row.sourceRow}.`);
  }
  await client.query("COMMIT");
  const envelope = { manifest, rows, beforeImages: current.matches.filter((match) => rows.some((row) => row.opportunityId === match.opportunity_id && row.repreneurId === match.repreneur_id)) };
  const bytes = `${JSON.stringify(envelope, null, 2)}\n`;
  if (mode === "--prepare") {
    fs.writeFileSync(manifestPath, bytes, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ mode, source: V4_SOURCE_SHA, summary: manifest.summary, existingDraftDrops: manifest.existingDraftDrops, manifestFileSha256: sha256(bytes) }));
  } else {
    const approvedBytes = fs.readFileSync(manifestPath, "utf8");
    const approved = JSON.parse(approvedBytes);
    if (JSON.stringify(v4ApplyRows(approved.manifest, source)) !== JSON.stringify(approved.rows)) throw new Error("Manifest source rows differ from the exact V4 workbook.");
    if (!appliedRows && (JSON.stringify(approved.manifest) !== JSON.stringify(manifest) || JSON.stringify(approved.rows) !== JSON.stringify(rows))) throw new Error("Live state or approved resolution has changed; do not apply this manifest.");
    if (mode === "--check") console.log(JSON.stringify({ mode, source: V4_SOURCE_SHA, summary: approved.manifest.summary, existingDraftDrops: approved.manifest.existingDraftDrops, unchanged: true, alreadyApplied: appliedRows === 72 }));
    else {
      if (sha256(approvedBytes) !== approvedDigest) throw new Error("The approved manifest-file digest does not match.");
      // The database locks and independently rechecks every pinned before-image.
      const result = await client.query("SELECT public.apply_pursuit_workbook_v4($1::JSONB,$2) AS result", [JSON.stringify(approved.rows), actor]);
      console.log(JSON.stringify({ mode, result: result.rows[0].result }));
    }
  }
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { /* connection may be absent */ }
  // Do not print a connection URL, private payload, or database detail.
  console.error(error instanceof Error && /^(Live state|Source digest|The approved|Manifest source|Invalid V4|V4 terminal|Expected the exact)/.test(error.message)
    ? error.message : "Pursuit V4 operation failed. No successful apply is confirmed; inspect the bounded operator and retry safely.");
  process.exitCode = 1;
} finally { await client.end(); }
