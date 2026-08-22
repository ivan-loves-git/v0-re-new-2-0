#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { assertNoTopLevelTransactionControl } from "../../lib/qa/sql-safety.mjs"

const workspaceRoot = await realpath(process.cwd())
const candidateRoot = await realpath(resolve(workspaceRoot, process.env.QA_CANDIDATE_ROOT || "."))

function fail(code) {
  throw new Error(`QA candidate contract verification failed: ${code}`)
}

function candidatePath(path) {
  if (typeof path !== "string" || !/^supabase\/schema\/[a-z0-9_]+\.sql$/.test(path)) fail("path")
  const resolved = resolve(candidateRoot, path)
  const boundary = relative(candidateRoot, resolved)
  if (boundary.startsWith("..") || boundary === "") fail("path")
  return resolved
}

try {
  const contract = JSON.parse(await readFile(resolve(candidateRoot, "supabase/qa-contract.json"), "utf8"))
  if (
    typeof contract.version !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{2,79}$/.test(contract.version) ||
    !/^[0-9a-f]{64}$/.test(contract.structureFingerprint || "") ||
    /^0{64}$/.test(contract.structureFingerprint) ||
    !Array.isArray(contract.files)
  ) fail("contract")
  const paths = contract.files.map((file) => file.path)
  if (
    paths.length < 5 ||
    new Set(paths).size !== paths.length ||
    !paths[0]?.endsWith("_extensions.sql") ||
    paths[1] !== "supabase/schema/qa_control.sql" ||
    paths[2] !== "supabase/schema/permanent_qa_rebuild.sql"
  ) fail("sequence")
  for (const file of contract.files) {
    const content = await readFile(candidatePath(file.path))
    if (/^\s*\\/m.test(content.toString("utf8"))) fail("psql-meta-command")
    try {
      assertNoTopLevelTransactionControl(content.toString("utf8"))
    } catch {
      fail("sql-transaction-control")
    }
    if (!/^[0-9a-f]{64}$/.test(file.sha256 || "")) fail("checksum")
    if (createHash("sha256").update(content).digest("hex") !== file.sha256) fail("checksum")
  }
  console.log(JSON.stringify({ ok: true, version: contract.version, structureFingerprint: contract.structureFingerprint, files: contract.files.length }))
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith("QA candidate contract verification failed:") ? error.message : "QA candidate contract verification failed: read")
  process.exit(1)
}
