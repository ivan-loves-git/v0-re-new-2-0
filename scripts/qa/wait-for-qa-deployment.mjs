#!/usr/bin/env node
import { appendFile } from "node:fs/promises"
import {
  assertAliasServesAdmittedSha,
  assertExplicitQaDeploymentReady,
} from "../../lib/qa/explicit-deploy.mjs"
import {
  probeStableQaAlias,
  waitForQaDeployment,
} from "../../lib/qa/deployment-status.mjs"
import { stableQaOrigin } from "../../lib/qa/permanent-contract.mjs"

/**
 * Protected QA uses scripts/qa/deploy-admitted-candidate.mjs.
 * This waiter remains for:
 * - re-checking an already-created explicit deployment id
 * - reviewed rollback to the legacy GitHub Deployment path only when
 *   QA_DEPLOY_WAIT_MODE=legacy-github is set deliberately
 */
const repository = process.env.GITHUB_REPOSITORY
const sha = process.env.QA_EXPECTED_SHA
const token = process.env.GITHUB_TOKEN
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const explicitDeploymentId = process.env.QA_VERCEL_DEPLOYMENT_ID
const vercelToken = process.env.QA_VERCEL_TOKEN
const teamId = process.env.QA_VERCEL_TEAM_ID || ""
const expectedEnvironment = "Preview – renew-overnight-validation-20260820"
const laneMovedAt = Date.parse(process.env.QA_LANE_MOVED_AT || "")
const deadline = Date.now() + 8 * 60 * 1000
const mode = process.env.QA_DEPLOY_WAIT_MODE || "explicit"

function fail(code) {
  throw new Error(`QA deployment wait failed: ${code}`)
}

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  })
  if (!response.ok) fail(`github-${response.status}`)
  return response.json()
}

async function vercelApi(path) {
  const url = new URL(`https://api.vercel.com${path}`)
  if (teamId) url.searchParams.set("teamId", teamId)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" },
  })
  if (!response.ok) fail(`vercel-${response.status}`)
  return response.json()
}

async function waitExplicit() {
  if (!explicitDeploymentId || !vercelToken || !bypass || !sha) fail("explicit-configuration")
  while (Date.now() < deadline) {
    const deployment = await vercelApi(`/v13/deployments/${explicitDeploymentId}`)
    if (deployment.readyState === "READY") {
      const identity = assertExplicitQaDeploymentReady({ deployment, expectedSha: sha })
      const servedSha = await probeStableQaAlias({ origin: stableQaOrigin(), bypass })
      assertAliasServesAdmittedSha({
        aliasOrigin: stableQaOrigin(),
        servedSha,
        expectedSha: sha,
      })
      return {
        deploymentId: identity.deploymentId,
        readyAt: new Date().toISOString(),
        providerUrl: identity.url || stableQaOrigin(),
      }
    }
    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      fail(`ready-state-${deployment.readyState}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000))
  }
  fail("timeout")
}

async function waitLegacyGithub() {
  if (!Number.isFinite(laneMovedAt)) fail("lane-timestamp")
  if (!repository || !sha || !token || !bypass) fail("configuration")
  return waitForQaDeployment({
    expectedSha: sha,
    expectedEnvironment,
    laneMovedAt,
    deadline,
    listDeployments: () => github(`/deployments?sha=${sha}&per_page=20`),
    listStatuses: (deploymentId) => github(`/deployments/${deploymentId}/statuses?per_page=20`),
    probeAliasSha: () => probeStableQaAlias({ origin: stableQaOrigin(), bypass }),
  })
}

try {
  if (mode !== "legacy-github" && mode !== "explicit") fail("mode")
  const output = mode === "legacy-github" ? await waitLegacyGithub() : await waitExplicit()
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `deployment_id=${output.deploymentId}\nready_at=${output.readyAt}\nprovider_url=${output.providerUrl}\n`)
  }
  console.log(JSON.stringify({ ok: true, mode, ...output }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA deployment wait failed: unknown")
  process.exit(1)
}
