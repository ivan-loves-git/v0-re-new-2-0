#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { reconcileHistoricalPursuits } from "./historical-pursuit-manifest.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const ACTOR = "W-112 historical pursuit import";

function options(argv) {
  const result = { mode: null, envFile: ".env.local", workbook: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--rehearse" || value === "--apply") result.mode = value.slice(2);
    else if (value === "--env-file") { result.envFile = argv[++index]; }
    else if (!value.startsWith("--") && !result.workbook) result.workbook = value;
    else throw new Error(`Unknown or repeated option: ${value}`);
  }
  if (!result.workbook || !result.mode) throw new Error("Usage: node scripts/run-historical-pursuit-import.mjs <workbook.xlsx> --rehearse|--apply [--env-file .env.local]");
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
try {
  await client.connect();
  const manifest = reconcileHistoricalPursuits(parsed, await snapshot(client));
  await client.query("BEGIN");
  const results = [];
  for (const record of manifest.records) {
    if (!record.buyer) throw new Error(`Source row ${record.sourceRow} has no exact repreneur.`);
    const result = await client.query(
      "SELECT public.apply_historical_pursuit_import_row($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result",
      [parsed.source.sha256, parsed.source.sheet, record.sourceRow, record.buyer.id, record.opportunity?.id ?? null,
        record.historicalProposal.completedSourceStages, record.historicalProposal.notApplicableSourceStages,
        record.historicalProposal.dropReason, true, ACTOR],
    );
    results.push(result.rows[0].result);
  }
  if (config.mode === "rehearse") await client.query("ROLLBACK");
  else await client.query("COMMIT");
  const outcomes = results.reduce((counts, item) => ({ ...counts, [item.outcome]: (counts[item.outcome] ?? 0) + 1 }), {});
  process.stdout.write(`${JSON.stringify({ mode: config.mode, source: parsed.source, manifest: manifest.summary, proposed: manifest.safeApplySummary, outcomes })}\n`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch { /* no transaction */ }
  throw error;
} finally { await client.end(); }
