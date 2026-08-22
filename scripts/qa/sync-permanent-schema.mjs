#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { spawn } from "node:child_process"
import pg from "pg"
import { computeLiveStructureFingerprint } from "../../lib/qa/structure-fingerprint.mjs"
import { QA_CONTRACT } from "../../lib/qa/permanent-contract.mjs"
import { validateBranchReconstructionEvidence } from "../../lib/qa/isolation-preflight.mjs"
import { assertNoTopLevelTransactionControl } from "../../lib/qa/sql-safety.mjs"
import { countPublicRows } from "./phase-b-common.mjs"

const { Client } = pg
const ROOT = await realpath(resolve(process.cwd(), process.env.QA_CANDIDATE_ROOT || "."))
const CONTRACT_PATH = resolve(ROOT, "supabase/qa-contract.json")

function fail(code) {
  throw new Error(`QA schema synchronization failed: ${code}`)
}

function parseDatabase() {
  const projectRef = process.env.QA_SUPABASE_PROJECT_REF
  if (!/^[a-z0-9]{20}$/.test(projectRef || "") || projectRef === QA_CONTRACT.productionRef) fail("project-ref")
  let database
  try {
    database = new URL(process.env.DATABASE_URL)
  } catch {
    fail("database-url")
  }
  if (!/^postgres(?:ql)?:$/.test(database.protocol)) fail("database-url")
  const direct = database.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
  const pooled = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(database.hostname)
    ? decodeURIComponent(database.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
    : undefined
  if ((direct || pooled) !== projectRef) fail("database-ref")
  return database
}

async function readContract() {
  const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8"))
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(contract.version || "") || !/^[0-9a-f]{64}$/.test(contract.structureFingerprint || "") || /^0{64}$/.test(contract.structureFingerprint) || !Array.isArray(contract.files)) fail("contract")
  const paths = contract.files.map((file) => file.path)
  if (
    paths.length < 5 ||
    new Set(paths).size !== paths.length ||
    paths.some((path) => typeof path !== "string" || !/^supabase\/schema\/[a-z0-9_]+\.sql$/.test(path)) ||
    !paths[0].endsWith("_extensions.sql") ||
    paths[1] !== "supabase/schema/qa_control.sql" ||
    paths[2] !== "supabase/schema/permanent_qa_rebuild.sql"
  ) fail("contract-files")
  for (const file of contract.files) {
    const content = await readFile(resolve(ROOT, file.path))
    if (/^\s*\\/m.test(content.toString("utf8"))) fail("psql-meta-command")
    try {
      assertNoTopLevelTransactionControl(content.toString("utf8"))
    } catch {
      fail("sql-transaction-control")
    }
    if (createHash("sha256").update(content).digest("hex") !== file.sha256) fail("artifact-checksum")
  }
  return contract
}

async function assertProvisionedBranchContract() {
  const branch = JSON.parse(await readFile(resolve(ROOT, "supabase/qa-branch.json"), "utf8"))
  try {
    validateBranchReconstructionEvidence(branch, process.env.QA_SUPABASE_PROJECT_REF, {
      allowInitialMigrationFailure: true,
    })
  } catch {
    fail("branch-contract")
  }
}

function psqlEnvironment(database) {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG || "C.UTF-8",
    PGHOST: database.hostname,
    PGPORT: database.port || "5432",
    PGUSER: decodeURIComponent(database.username),
    PGPASSWORD: decodeURIComponent(database.password),
    PGDATABASE: database.pathname.slice(1) || "postgres",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: process.env.QA_DATABASE_CA_CERT_FILE,
  }
}

async function runPsql(database, files, singleTransaction, ledger) {
  const args = ["-X", "--quiet", "--set", "ON_ERROR_STOP=1"]
  if (singleTransaction) args.push("--single-transaction")
  for (const file of files) args.push("--file", resolve(ROOT, file))
  if (ledger) {
    const values = ledger.files.map((file, index) => `('${ledger.version}',${index + 1},'${file.path}','${file.sha256}')`).join(",")
    args.push("--command", `DELETE FROM qa_control.applied_files; INSERT INTO qa_control.applied_files (contract_version, position, path, sha256) VALUES ${values}; UPDATE qa_control.schema_state SET contract_version='${ledger.version}', structure_fingerprint='${ledger.structureFingerprint}', blocked_reason=NULL, updated_at=now() WHERE singleton=true;`)
  }
  const child = spawn("psql", args, { env: psqlEnvironment(database), stdio: ["ignore", "ignore", "pipe"] })
  let stderr = ""
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk) => { stderr += chunk })
  const status = await new Promise((resolveStatus, reject) => {
    child.once("error", reject)
    child.once("close", resolveStatus)
  })
  if (status !== 0) fail(`psql-${status}-${stderr.includes("qa-schema-sync-non-empty") ? "non-empty" : "ddl"}`)
}

async function appliedLedgerMatches(database, contract) {
  const result = await database.query("SELECT contract_version, position, path, sha256 FROM qa_control.applied_files ORDER BY contract_version, position")
  const expected = contract.files.map((file, index) => ({ contract_version: contract.version, position: index + 1, path: file.path, sha256: file.sha256 }))
  return JSON.stringify(result.rows) === JSON.stringify(expected)
}

async function assertAppliedLedger(database, contract) {
  if (!await appliedLedgerMatches(database, contract)) fail("applied-ledger")
}

async function replaceMatchingStructureLedger(database, contract) {
  await database.query("BEGIN")
  try {
    await database.query("SELECT pg_advisory_xact_lock(hashtextextended('renew-permanent-qa-lease', 20260822))")
    const activeLease = await database.query("SELECT count(*)::int AS count FROM qa_control.lease")
    if (activeLease.rows[0].count !== 0) fail("active-lease")
    await database.query("DELETE FROM qa_control.applied_files")
    for (const [index, file] of contract.files.entries()) {
      await database.query("INSERT INTO qa_control.applied_files (contract_version, position, path, sha256) VALUES ($1,$2,$3,$4)", [contract.version, index + 1, file.path, file.sha256])
    }
    await database.query("UPDATE qa_control.schema_state SET contract_version=$1, structure_fingerprint=$2, blocked_reason=NULL, updated_at=now() WHERE singleton=true", [contract.version, contract.structureFingerprint])
    await database.query("COMMIT")
  } catch (error) {
    await database.query("ROLLBACK").catch(() => {})
    throw error
  }
}

async function assertEmptyApprovedBranch(database) {
  const [applicationRows, nonPublicRows] = await Promise.all([
    countPublicRows(database),
    database.query("SELECT (SELECT count(*)::int FROM auth.users) + (SELECT count(*)::int FROM storage.objects) AS count"),
  ])
  if (applicationRows !== 0 || nonPublicRows.rows[0].count !== 0) fail("non-empty")
  const control = await database.query("SELECT to_regclass('qa_control.lease') IS NOT NULL AS installed")
  if (control.rows[0].installed) {
    const activeLease = await database.query("SELECT count(*)::int AS count FROM qa_control.lease")
    if (activeLease.rows[0].count !== 0) fail("active-lease")
  }
}

async function connect(connection) {
  const client = new Client({
    host: connection.hostname,
    port: Number(connection.port || "5432"),
    user: decodeURIComponent(connection.username),
    password: decodeURIComponent(connection.password),
    database: connection.pathname.slice(1) || "postgres",
    ssl: { ca: await readFile(process.env.QA_DATABASE_CA_CERT_FILE, "utf8"), rejectUnauthorized: true },
  })
  await client.connect()
  return client
}

let database
try {
  const contract = await readContract()
  const connection = parseDatabase()
  await assertProvisionedBranchContract()
  if (!process.env.QA_DATABASE_CA_CERT_FILE) fail("database-ca")
  await readFile(process.env.QA_DATABASE_CA_CERT_FILE).catch(() => fail("database-ca"))
  database = await connect(connection)
  const liveBefore = await computeLiveStructureFingerprint(database)
  if (liveBefore === contract.structureFingerprint) {
    await assertEmptyApprovedBranch(database)
    if (!await appliedLedgerMatches(database, contract)) await replaceMatchingStructureLedger(database, contract)
    await assertAppliedLedger(database, contract)
    await database.query("UPDATE qa_control.schema_state SET contract_version=$1, structure_fingerprint=$2, blocked_reason=NULL, updated_at=now() WHERE singleton=true", [contract.version, liveBefore])
    console.log(JSON.stringify({ ok: true, changed: false, structureFingerprint: liveBefore, contractVersion: contract.version }))
  } else {
    await assertEmptyApprovedBranch(database)
    await database.end()
    database = undefined
    await runPsql(connection, contract.files.slice(0, 2).map((file) => file.path), true)
    try {
      await runPsql(connection, contract.files.map((file) => file.path), true, contract)
    } catch (error) {
      database = await connect(connection)
      await database.query("UPDATE qa_control.schema_state SET blocked_reason=$1, updated_at=now() WHERE singleton=true", ["transactional synchronization failed"])
      throw error
    }
    database = await connect(connection)
    const liveAfter = await computeLiveStructureFingerprint(database)
    await assertAppliedLedger(database, contract)
    if (liveAfter !== contract.structureFingerprint) {
      await database.query("UPDATE qa_control.schema_state SET structure_fingerprint=$1, blocked_reason=$2, updated_at=now() WHERE singleton=true", [liveAfter, "structure fingerprint mismatch"])
      fail("structure fingerprint")
    }
    await database.query("UPDATE qa_control.schema_state SET contract_version=$1, structure_fingerprint=$2, blocked_reason=NULL, updated_at=now() WHERE singleton=true", [contract.version, liveAfter])
    console.log(JSON.stringify({ ok: true, changed: true, structureFingerprint: liveAfter, contractVersion: contract.version }))
  }
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("QA schema synchronization failed:") ? error.message : "QA schema synchronization failed: unknown")
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
