#!/usr/bin/env node
import { buildFixtureManifest } from "../../lib/qa/phase-b.mjs"
import { RUN_DIR, writePrivateJson } from "./phase-b-common.mjs"

const manifest = buildFixtureManifest(process.env.QA_RUN_ID || "")
const rehearsal = {
  runId: manifest.runId,
  fixturePrefix: manifest.fixturePrefix,
  databaseRows: [
    manifest.databaseRows.find((row) => row.table === "user"),
    manifest.databaseRows.find((row) => row.table === "repreneurs"),
    manifest.databaseRows.find((row) => row.table === "app_user_roles"),
  ],
  betterAuthIdentities: [manifest.betterAuthIdentities[0]],
  storageObjects: manifest.storageObjects,
}
await writePrivateJson(`${RUN_DIR}/rehearsal-manifest.json`, rehearsal)
console.log(JSON.stringify({ ok: true, rows: rehearsal.databaseRows.length, identities: 1, objects: 1 }))
