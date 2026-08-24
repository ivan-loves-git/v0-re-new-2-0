import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { assertNoTopLevelTransactionControl } from "./sql-safety.mjs"

const FILE_PATH = /^supabase\/schema\/[a-z0-9_]+\.sql$/
const SHA256 = /^[0-9a-f]{64}$/
const SENTINEL = /^f{64}$/
const PENDING_SENTINEL = "PENDING_CI_FINGERPRINT"

function fail(code) {
  throw new Error(`QA contract fingerprint rehearsal failed: ${code}`)
}

async function checkedPath(root, path) {
  if (typeof path !== "string" || !FILE_PATH.test(path)) fail("path")
  const target = resolve(root, path)
  let canonicalTarget
  try {
    canonicalTarget = await realpath(target)
  } catch {
    fail("read")
  }
  const boundary = relative(root, canonicalTarget)
  if (boundary === "" || boundary === ".." || boundary.startsWith("../")) fail("path")
  return canonicalTarget
}

export async function loadFingerprintRehearsalContract(root = process.cwd()) {
  const canonicalRoot = await realpath(root)
  let contract
  try {
    const contractPath = resolve(canonicalRoot, "supabase/qa-contract.json")
    if (await realpath(contractPath) !== contractPath) fail("contract-path")
    contract = JSON.parse(await readFile(contractPath, "utf8"))
  } catch {
    fail("contract")
  }
  if (
    typeof contract.version !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(contract.version) ||
    !(SHA256.test(contract.structureFingerprint || "") || contract.structureFingerprint === PENDING_SENTINEL) ||
    /^0{64}$/.test(contract.structureFingerprint) ||
    !Array.isArray(contract.files) ||
    contract.files.length < 5
  ) fail("contract")

  const paths = contract.files.map((file) => file?.path)
  if (
    new Set(paths).size !== paths.length ||
    !paths[0]?.endsWith("_extensions.sql") ||
    paths[1] !== "supabase/schema/qa_control.sql" ||
    paths[2] !== "supabase/schema/permanent_qa_rebuild.sql"
  ) fail("sequence")

  const files = []
  for (const file of contract.files) {
    if (!SHA256.test(file?.sha256 || "")) fail("checksum")
    const path = await checkedPath(canonicalRoot, file.path)
    let content
    try {
      content = await readFile(path, "utf8")
    } catch {
      fail("read")
    }
    if (/^\s*\\/m.test(content)) fail("psql-meta-command")
    try {
      assertNoTopLevelTransactionControl(content)
    } catch {
      fail("sql-transaction-control")
    }
    if (createHash("sha256").update(content).digest("hex") !== file.sha256) fail("checksum")
    files.push({ path: file.path, sha256: file.sha256, content })
  }
  return { contract, files }
}

export function assertPinnedFingerprint(expected, actual) {
  if (!SHA256.test(actual || "")) fail("actual-fingerprint")
  if (SENTINEL.test(expected || "") || expected === PENDING_SENTINEL) fail("sentinel")
  if (actual !== expected) fail("structure-fingerprint")
}
