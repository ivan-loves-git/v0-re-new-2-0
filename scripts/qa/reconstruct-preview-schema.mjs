#!/usr/bin/env node

import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { validateBranchReconstructionEvidence } from "../../lib/qa/isolation-preflight.mjs"

const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const projectRef = process.env.QA_SUPABASE_PROJECT_REF
const databaseUrl = process.env.DATABASE_URL
const branchEvidencePath = process.env.QA_BRANCH_EVIDENCE_FILE

function fail(code) {
  throw new Error(`Schema reconstruction failed: ${code}`)
}

function parseDatabase() {
  if (!projectRef || projectRef === PRODUCTION_REF || !/^[a-z0-9]{20}$/.test(projectRef)) {
    fail("production-ref")
  }
  if (!databaseUrl) fail("database-ref")
  let connection
  try {
    connection = new URL(databaseUrl)
  } catch {
    fail("database-ref")
  }
  if (!/^postgresql?:$/.test(connection.protocol)) fail("database-ref")
  const directRef = connection.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
  const isSupabasePooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(connection.hostname)
  const pooledRef = isSupabasePooler
    ? decodeURIComponent(connection.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
    : undefined
  if ((directRef || pooledRef) !== projectRef) fail("database-ref")
  return connection
}

function safeDiagnostic(value) {
  return value
    .replaceAll(PRODUCTION_REF, "[production-ref-redacted]")
    .replaceAll(projectRef || "", "[preview-ref-redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection-redacted]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .trim()
}

function psqlEnv(connection) {
  return {
    PATH: process.env.PATH,
    PGHOST: connection.hostname,
    PGPORT: connection.port || "5432",
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGDATABASE: connection.pathname.slice(1) || "postgres",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "system",
  }
}

async function runPsql(connection, args) {
  const child = spawn("/opt/homebrew/opt/postgresql@17/bin/psql", ["-X", ...args], {
    env: psqlEnv(connection),
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })
  const status = await new Promise((resolveStatus, reject) => {
    child.once("error", reject)
    child.once("close", resolveStatus)
  })
  if (status !== 0) {
    throw new Error(
      `Schema reconstruction failed: psql-${status}: ${safeDiagnostic(stderr) || "no diagnostic"}`,
    )
  }
  return stdout.trim()
}

try {
  if (!branchEvidencePath) fail("branch-evidence")
  let branchEvidence
  try {
    branchEvidence = JSON.parse(await readFile(branchEvidencePath, "utf8"))
    validateBranchReconstructionEvidence(branchEvidence, projectRef)
  } catch {
    fail("branch-evidence")
  }
  const connection = parseDatabase()
  const occupancy = await runPsql(connection, [
    "--tuples-only",
    "--no-align",
    "--command",
    `WITH public_ns AS (SELECT oid FROM pg_namespace WHERE nspname='public')
     SELECT CASE WHEN
       to_regclass('public.repreneurs') IS NULL
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_collation WHERE collnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_conversion WHERE connamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_operator WHERE oprnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_opclass WHERE opcnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_opfamily WHERE opfnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_ts_dict WHERE dictnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_ts_parser WHERE prsnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_ts_template WHERE tmplnamespace=(SELECT oid FROM public_ns))
       AND NOT EXISTS (SELECT 1 FROM pg_statistic_ext WHERE stxnamespace=(SELECT oid FROM public_ns))
     THEN 'empty' ELSE 'occupied' END;`,
  ])
  if (occupancy !== "empty") fail("schema-not-empty")

  const files = [
    "supabase/schema/771_extensions.sql",
    "supabase/schema/771_public_schema.sql",
    "supabase/schema/771_test_storage.sql",
  ]
  await runPsql(connection, [
    "--quiet",
    "--single-transaction",
    "--set",
    "ON_ERROR_STOP=1",
    ...files.flatMap((file) => ["--file", resolve(process.cwd(), file)]),
  ])
  console.log(JSON.stringify({ ok: true, projectRef, filesApplied: files.length }))
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith("Schema reconstruction failed:")
      ? error.message
      : "Schema reconstruction failed: unknown"
  console.error(message)
  process.exit(1)
}
