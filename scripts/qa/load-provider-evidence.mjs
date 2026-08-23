#!/usr/bin/env node
import { appendFile, readFile } from "node:fs/promises"
import { assertSanitizedProviderDeployEvidence } from "../../lib/qa/explicit-deploy.mjs"

const evidencePath = process.env.QA_PROVIDER_EVIDENCE_FILE || ".qa-deploy/provider-evidence.json"
const expectedSha = process.env.QA_EXPECTED_SHA
const expectedBranch = process.env.QA_CANDIDATE_BRANCH
const expectedDeploymentId = process.env.QA_VERCEL_DEPLOYMENT_ID || ""

try {
  if (process.env.QA_VERCEL_TOKEN) throw new Error("QA provider evidence failed: secret-coexistence")
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"))
  const verified = assertSanitizedProviderDeployEvidence(evidence, {
    deploymentId: expectedDeploymentId || evidence.deploymentId,
    candidateSha: expectedSha,
    candidateBranch: expectedBranch,
  })
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `deployment_id=${verified.deploymentId}`,
        `ready_at=${verified.readyAt}`,
        `provider_url=${verified.providerUrl}`,
        `candidate_sha=${verified.candidateSha}`,
        `git_ref=${verified.gitRef}`,
        `alias=${verified.alias}`,
      ].join("\n") + "\n",
    )
  }
  console.log(JSON.stringify({ ok: true, evidence: verified }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA provider evidence failed: unknown")
  process.exit(1)
}
