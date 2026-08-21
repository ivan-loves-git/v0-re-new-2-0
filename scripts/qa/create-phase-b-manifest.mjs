#!/usr/bin/env node
import { buildFixtureManifest } from "../../lib/qa/phase-b.mjs"
import { MANIFEST_FILE, writePrivateJson } from "./phase-b-common.mjs"

try {
  const manifest = buildFixtureManifest(process.env.QA_RUN_ID || "")
  await writePrivateJson(MANIFEST_FILE, manifest)
  console.log(JSON.stringify({ ok: true, runId: manifest.runId, rows: manifest.databaseRows.length, identities: manifest.betterAuthIdentities.length, objects: manifest.storageObjects.length }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "Fixture manifest failed: unknown")
  process.exitCode = 1
}
