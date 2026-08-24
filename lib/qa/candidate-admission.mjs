import { createHash } from "node:crypto"
import { lstat, readFile, realpath } from "node:fs/promises"
import { resolve, sep } from "node:path"

const CONTRACT_PATH = "supabase/qa-contract.json"
const REVIEW_VERSION = "qa-schema-review-v1"
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const SQL_PATH_PATTERN = /^supabase\/schema\/[a-z0-9_]+\.sql$/
const EXPLICIT_EVENTS = new Set(["workflow_dispatch"])

function fail(code) {
  throw new Error(`QA candidate contract failed: ${code}`)
}

function digest(content) {
  return createHash("sha256").update(content).digest("hex")
}

async function readRepositoryFile(root, path) {
  const canonicalRoot = await realpath(root)
  const filePath = resolve(canonicalRoot, path)
  if (!filePath.startsWith(`${canonicalRoot}${sep}`)) fail("file-path")
  const metadata = await lstat(filePath).catch(() => fail("file-read"))
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail("file-type")
  const canonicalFile = await realpath(filePath)
  if (!canonicalFile.startsWith(`${canonicalRoot}${sep}`)) fail("file-path")
  return readFile(canonicalFile)
}

function parseContract(content) {
  let contract
  try {
    contract = JSON.parse(content.toString("utf8"))
  } catch {
    fail("contract-json")
  }
  if (
    typeof contract?.version !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(contract.version) ||
    !SHA256_PATTERN.test(contract?.structureFingerprint || "") ||
    /^0{64}$/.test(contract.structureFingerprint) ||
    !Array.isArray(contract.files) ||
    contract.files.length === 0
  ) {
    fail("contract")
  }
  const paths = contract.files.map((file) => file?.path)
  if (
    new Set(paths).size !== paths.length ||
    contract.files.some((file) => !SQL_PATH_PATTERN.test(file?.path || "") || !SHA256_PATTERN.test(file?.sha256 || ""))
  ) {
    fail("contract-files")
  }
  return contract
}

async function readVerifiedContract(root) {
  const content = await readRepositoryFile(root, CONTRACT_PATH)
  const contract = parseContract(content)
  const files = new Map()
  for (const file of contract.files) {
    const sql = await readRepositoryFile(root, file.path)
    if (digest(sql) !== file.sha256) fail("artifact-checksum")
    files.set(file.path, sql)
  }
  return { content, contract, files, contractSha256: digest(content) }
}

function contractsMatch(trusted, candidate) {
  const filesMatch = trusted.contract.files.every((file) => candidate.files.get(file.path)?.equals(trusted.files.get(file.path)))
  return candidate.content.equals(trusted.content) && candidate.contract.files.length === trusted.contract.files.length && filesMatch
}

export async function validateCandidateContractAdmission({ eventName, trustedRoot, candidateRoot, dispatch = {} }) {
  if (!EXPLICIT_EVENTS.has(eventName)) fail("event")
  const candidate = await readVerifiedContract(candidateRoot)
  const trusted = await readVerifiedContract(trustedRoot)
  const identical = contractsMatch(trusted, candidate)

  if (dispatch.schemaReviewed === true) {
    if (dispatch.schemaReviewVersion !== REVIEW_VERSION) fail("dispatch-schema-review")
    if (!SHA256_PATTERN.test(dispatch.contractSha256 || "") || dispatch.contractSha256 !== candidate.contractSha256) {
      fail("dispatch-contract-sha256")
    }
    if (identical) fail("dispatch-no-schema-change")
    return {
      admission: "reviewed-schema-change",
      contractSha256: candidate.contractSha256,
      schemaReviewVersion: REVIEW_VERSION,
    }
  }

  if (dispatch.schemaReviewed === false || dispatch.schemaReviewVersion || dispatch.contractSha256) {
    fail("dispatch-schema-review")
  }
  if (!identical) fail("explicit-identical-required")
  return { admission: "trusted-main-identical", contractSha256: candidate.contractSha256 }
}

export const QA_SCHEMA_REVIEW_VERSION = REVIEW_VERSION
