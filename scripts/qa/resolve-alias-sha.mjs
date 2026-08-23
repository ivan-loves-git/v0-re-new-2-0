#!/usr/bin/env node
import { appendFile } from "node:fs/promises"
import { probeStableQaAlias } from "../../lib/qa/deployment-status.mjs"
import { stableQaOrigin } from "../../lib/qa/permanent-contract.mjs"

const SHA_PATTERN = /^[0-9a-f]{40}$/

try {
  if (process.env.QA_VERCEL_TOKEN) throw new Error("QA alias SHA failed: secret-coexistence")
  for (const forbidden of ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[forbidden]) throw new Error("QA alias SHA failed: secret-coexistence")
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (!bypass) throw new Error("QA alias SHA failed: bypass")
  const sha = await probeStableQaAlias({ origin: stableQaOrigin(), bypass })
  if (!SHA_PATTERN.test(sha || "")) throw new Error("QA alias SHA failed: alias-sha")
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\n`)
  }
  console.log(JSON.stringify({ ok: true, origin: stableQaOrigin(), candidateSha: sha }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA alias SHA failed: unknown")
  process.exit(1)
}
