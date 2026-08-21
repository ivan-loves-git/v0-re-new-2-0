#!/usr/bin/env node
import { readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { RUN_DIR, removeRunnerSecrets, writePrivateJson } from "./phase-b-common.mjs"

const sensitiveValues = [
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  process.env.DATABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.BETTER_AUTH_SECRET,
  process.env.GITHUB_TOKEN,
].filter((value) => typeof value === "string" && value.length >= 8)

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return (await Promise.all(entries.map(async (entry) => {
    const full = join(path, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  }))).flat()
}

await removeRunnerSecrets()
const files = await walk(RUN_DIR)
let removedTraceArchives = 0
for (const file of files.filter((path) => path.endsWith(".zip"))) {
  await rm(file, { force: true })
  removedTraceArchives += 1
}
await writePrivateJson(`${RUN_DIR}/sanitized-traces.json`, {
  rawTraceArchivesRemoved: removedTraceArchives,
  networkPayloadsRetained: false,
  sessionStateRetained: false,
  note: "Raw retry traces are intentionally not uploaded; HTML and failure screenshots remain.",
})

for (const file of (await walk(RUN_DIR)).filter((path) => /\.(json|html|txt|trace)$/.test(path))) {
  let text = await readFile(file, "utf8")
  for (const value of sensitiveValues) text = text.split(value).join("[REDACTED]")
  await writeFile(file, text)
}

for (const file of await walk(RUN_DIR)) {
  if (!/\.(json|html|txt|trace|zip|png|jpg|jpeg|webp)$/.test(file)) await rm(file, { force: true })
}
const sanitizedFiles = await walk(RUN_DIR)
for (const file of sanitizedFiles) {
  if (/(credentials|storage.?state|\/auth\/|\.zip$)/i.test(file)) throw new Error("Artifact sanitization failed: forbidden-file")
  if (!/\.(json|html|txt|trace)$/.test(file)) continue
  const text = await readFile(file, "utf8")
  if (sensitiveValues.some((value) => text.includes(value))) throw new Error("Artifact sanitization failed: secret-residue")
}
console.log(JSON.stringify({ ok: true, sanitizedFiles: sanitizedFiles.length, rawTraceArchivesRemoved: removedTraceArchives, networkPayloadsRemoved: true, runnerSecretsRemoved: true }))
