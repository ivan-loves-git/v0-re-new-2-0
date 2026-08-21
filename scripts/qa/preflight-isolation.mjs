#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import { validateIsolationPreflight } from "../../lib/qa/isolation-preflight.mjs"

async function readJson(path, code) {
  if (!path) throw new Error(`Isolation preflight failed: ${code}`)
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch {
    throw new Error(`Isolation preflight failed: ${code}`)
  }
}

try {
  const evidence = await readJson(
    process.env.QA_PREFLIGHT_EVIDENCE_FILE,
    "evidence-file",
  )
  const manifest = await readJson(
    process.env.QA_FIXTURE_MANIFEST_FILE,
    "fixture-manifest-file",
  )
  const result = validateIsolationPreflight({
    env: process.env,
    evidence,
    manifest,
  })
  console.log(
    JSON.stringify({
      ok: true,
      projectRef: result.projectRef,
      origin: result.origin,
      runId: result.runId,
    }),
  )
} catch (error) {
  const message =
    error instanceof Error && error.message.startsWith("Isolation preflight failed:")
      ? error.message
      : "Isolation preflight failed: unknown"
  console.error(message)
  process.exitCode = 1
}
