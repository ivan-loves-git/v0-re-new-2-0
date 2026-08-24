#!/usr/bin/env node
import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { acquireQaLease, loadAdmittedQaContract } from "../../lib/qa/lease-contract.mjs"
import { assertRecoveryFixtureManifest } from "../../lib/qa/phase-b.mjs"
import {
  MANIFEST_FILE,
  RUNTIME_FIXTURES_FILE,
  RUN_DIR,
  countPublicRows,
  databaseClient,
  writePrivateJson,
} from "./phase-b-common.mjs"

const action = process.argv[2]
const owner = process.env.QA_LEASE_OWNER
const runId = process.env.QA_RUN_ID
const candidateSha = process.env.QA_EXPECTED_SHA
const allowPreSchemaRecovery = action === "acquire" && process.env.QA_PRE_SCHEMA_RECOVERY === "true"
const SAFE_CONTRACT_FAILURES = new Set([
  "QA lease contract failed: candidate-root",
  "QA lease contract failed: contract",
])

class QaLeaseFailure extends Error {}

function fail(code) {
  throw new QaLeaseFailure(`QA lease failed: ${code}`)
}

async function runRecoveryCleanup() {
  const child = spawn(process.execPath, [resolve(process.cwd(), "scripts/qa/cleanup-phase-b.mjs")], {
    env: { ...process.env, QA_RECOVERY_MODE: "true" },
    stdio: "inherit",
  })
  const status = await new Promise((resolveStatus, reject) => {
    child.once("error", reject)
    child.once("close", resolveStatus)
  })
  if (status !== 0) fail("recovery-cleanup")
}

async function assertEmptyUnmanifestedLease(database) {
  const [applicationRows, nonPublicRows] = await Promise.all([
    countPublicRows(database),
    database.query("SELECT (SELECT count(*)::int FROM auth.users) + (SELECT count(*)::int FROM storage.objects) AS count"),
  ])
  if (applicationRows !== 0 || nonPublicRows.rows[0].count !== 0) fail("recovery-unmanifested-residue")
}

let database
try {
  if (!owner || owner.length < 32) fail("owner")
  if (!runId || !/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(runId)) fail("run-id")
  if (!/^[0-9a-f]{40}$/.test(candidateSha || "")) fail("candidate-sha")
  const contract = await loadAdmittedQaContract()
  database = await databaseClient()
  const state = await database.query("SELECT structure_fingerprint, blocked_reason FROM qa_control.schema_state WHERE singleton=true")
  if (state.rows[0]?.blocked_reason) fail("schema-blocked")
  if (!allowPreSchemaRecovery && state.rows[0]?.structure_fingerprint !== contract.structureFingerprint) fail("structure-fingerprint")

  if (action === "acquire") {
    let lease = await acquireQaLease(database, {
      runId,
      owner,
      candidateSha,
      structureFingerprint: contract.structureFingerprint,
    })
    if (lease.status === "busy") fail("busy")
    if (lease.status === "recovery-required") {
      const recoveryOwner = `${owner}-${randomBytes(16).toString("hex")}`
      process.env.QA_RECOVERY_OWNER = recoveryOwner
      const stale = (await database.query("SELECT qa_control.claim_expired_lease($1) AS result", [recoveryOwner])).rows[0].result
      const fixtureManifest = stale.manifest?.fixtureManifest
      if (!fixtureManifest) {
        await assertEmptyUnmanifestedLease(database)
      } else {
        try {
          assertRecoveryFixtureManifest(fixtureManifest, stale.runId)
        } catch {
          fail("recovery-manifest")
        }
        await writePrivateJson(MANIFEST_FILE, fixtureManifest)
        await writePrivateJson(RUNTIME_FIXTURES_FILE, stale.manifest?.runtime ?? {})
        await writePrivateJson(resolve(RUN_DIR, "singleton-before.json"), stale.singletonBefore ?? {})
        process.env.QA_RUN_ID = stale.runId
        process.env.QA_FIXTURE_PREFIX = fixtureManifest.fixturePrefix
        await database.end()
        database = undefined
        await runRecoveryCleanup()
        database = await databaseClient()
      }
      await database.query("SELECT qa_control.finish_recovery($1)", [recoveryOwner])
      process.env.QA_RUN_ID = runId
      process.env.QA_FIXTURE_PREFIX = `TEST-${runId}`
      lease = await acquireQaLease(database, {
        runId,
        owner,
        candidateSha,
        structureFingerprint: contract.structureFingerprint,
      })
    }
    if (lease.status !== "acquired") fail("acquire")
    console.log(JSON.stringify({ ok: true, status: "acquired", runId, recovered: Boolean(lease.recovered) }))
  } else if (action === "heartbeat") {
    await database.query("SELECT qa_control.heartbeat($1,$2,$3)", [runId, owner, 900])
    console.log(JSON.stringify({ ok: true, status: "heartbeat", runId }))
  } else if (action === "release") {
    await database.query("SELECT qa_control.release_lease($1,$2)", [runId, owner])
    console.log(JSON.stringify({ ok: true, status: "released", runId }))
  } else if (action === "inspect") {
    const lease = await database.query("SELECT run_id, candidate_sha, structure_fingerprint, status, heartbeat_at, expires_at FROM qa_control.lease WHERE singleton=true")
    console.log(JSON.stringify({ ok: true, lease: lease.rows[0] ?? null }))
  } else {
    fail("action")
  }
} catch (error) {
  const safeMessage = error instanceof QaLeaseFailure || (
    error instanceof Error && SAFE_CONTRACT_FAILURES.has(error.message)
  )
    ? error.message
    : "QA lease failed: database"
  console.error(safeMessage)
  process.exitCode = 1
} finally {
  await database?.end().catch(() => {})
}
