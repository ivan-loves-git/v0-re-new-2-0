import { readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

const ACQUIRE_LEASE_SQL = "SELECT qa_control.acquire_lease($1,$2,$3,$4,$5) AS result"

export async function loadAdmittedQaContract({
  workingDirectory = process.cwd(),
  candidateRoot = process.env.QA_CANDIDATE_ROOT,
} = {}) {
  let admittedRoot
  try {
    if (typeof candidateRoot !== "string" || candidateRoot.trim().length === 0) {
      throw new Error("missing-candidate-root")
    }
    const workspace = await realpath(workingDirectory)
    admittedRoot = await realpath(resolve(workspace, candidateRoot))
    const workspaceRelativeRoot = relative(workspace, admittedRoot)
    if (
      isAbsolute(workspaceRelativeRoot) ||
      workspaceRelativeRoot === ".." ||
      workspaceRelativeRoot.startsWith(`..${sep}`)
    ) {
      throw new Error("outside-workspace")
    }
  } catch {
    throw new Error("QA lease contract failed: candidate-root")
  }

  try {
    const contractPath = resolve(admittedRoot, "supabase/qa-contract.json")
    const canonicalContractPath = await realpath(contractPath)
    if (canonicalContractPath !== contractPath) throw new Error("contract-path")
    const contract = JSON.parse(await readFile(canonicalContractPath, "utf8"))
    if (
      typeof contract.structureFingerprint !== "string" ||
      !/^(?!0{64}$)[0-9a-f]{64}$/.test(contract.structureFingerprint)
    ) {
      throw new Error("invalid-fingerprint")
    }
    return contract
  } catch {
    throw new Error("QA lease contract failed: contract")
  }
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
