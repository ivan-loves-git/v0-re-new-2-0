import { readFile, realpath } from "node:fs/promises"
import { resolve } from "node:path"

const ACQUIRE_LEASE_SQL = "SELECT qa_control.acquire_lease($1,$2,$3,$4,$5) AS result"

export async function loadAdmittedQaContract({
  workingDirectory = process.cwd(),
  candidateRoot = process.env.QA_CANDIDATE_ROOT || ".",
} = {}) {
  const admittedRoot = await realpath(resolve(workingDirectory, candidateRoot))
  return JSON.parse(await readFile(resolve(admittedRoot, "supabase/qa-contract.json"), "utf8"))
}

export async function acquireQaLease(database, {
  runId,
  owner,
  candidateSha,
  structureFingerprint,
  ttlSeconds = 900,
}) {
  const result = await database.query(ACQUIRE_LEASE_SQL, [
    runId,
    owner,
    candidateSha,
    structureFingerprint,
    ttlSeconds,
  ])
  return result.rows[0].result
}
