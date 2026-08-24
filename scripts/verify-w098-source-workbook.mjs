#!/usr/bin/env node

// W-154 classification: local-only historical source-evidence preflight. The
// script is not imported by the application and never runs in CI or deployment.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import path from "node:path"
import pg from "pg"
import { hardenedDatabaseConfig } from "./database-tls.mjs"

const cliArgs = process.argv.slice(2)
if (cliArgs[0] === "--") cliArgs.shift()

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const verifierPath = path.join(scriptDirectory, "verify-w098-legacy-source-workbook.py")
const result = spawnSync("python3", [verifierPath, ...cliArgs], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024,
})

if (result.error) {
  console.error(`W-098 source preflight failed: ${result.error.message}`)
  process.exit(1)
}
if (result.stderr) process.stderr.write(result.stderr)
if (result.status !== 0) process.exit(result.status ?? 1)

let sourceProof
try {
  sourceProof = JSON.parse(result.stdout)
} catch {
  console.error("W-098 source preflight failed: source verifier returned invalid proof")
  process.exit(1)
}

const records = sourceProof.records
if (!Array.isArray(records) || records.length !== 6) {
  console.error("W-098 source preflight failed: source verifier did not return six mappings")
  process.exit(1)
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error("W-098 source preflight failed: DIRECT_URL or DATABASE_URL is required for the live read-only proof")
  process.exit(1)
}

function descriptionHash(value) {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
  return createHash("sha256").update(normalized).digest("hex")
}

const client = new pg.Client(hardenedDatabaseConfig(connectionString))

try {
  await client.connect()
  const ids = records.map((record) => record.opportunityId)
  const result = await client.query(
    "SELECT id::text AS id, reference, description FROM public.opportunities WHERE id = ANY($1::uuid[])",
    [ids],
  )
  if (result.rows.length !== records.length) {
    throw new Error("one or more live opportunities are missing")
  }
  const byId = new Map(result.rows.map((row) => [row.id, row]))
  for (const record of records) {
    const live = byId.get(record.opportunityId)
    if (
      !live ||
      live.reference !== record.liveReference ||
      descriptionHash(live.description) !== record.liveDescriptionHash
    ) {
      throw new Error("a live opportunity reference or description fingerprint no longer matches approved evidence")
    }
  }
  console.log(
    "W-098 source preflight passed: approved historical workbook, six source rows, and six current live description fingerprints verified.",
  )
} catch (error) {
  console.error(`W-098 source preflight failed: ${error instanceof Error ? error.message : "live evidence check failed"}`)
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}
