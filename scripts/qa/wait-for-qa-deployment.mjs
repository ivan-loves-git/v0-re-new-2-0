#!/usr/bin/env node
import { appendFile } from "node:fs/promises"
import {
  probeStableQaAlias,
  waitForQaDeployment,
} from "../../lib/qa/deployment-status.mjs"
import { stableQaOrigin } from "../../lib/qa/permanent-contract.mjs"

const repository = process.env.GITHUB_REPOSITORY
const sha = process.env.QA_EXPECTED_SHA
const token = process.env.GITHUB_TOKEN
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const expectedEnvironment = "Preview – renew-overnight-validation-20260820"
const laneMovedAt = Date.parse(process.env.QA_LANE_MOVED_AT || "")
const deadline = Date.now() + 8 * 60 * 1000

async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  })
  if (!response.ok) throw new Error(`QA deployment wait failed: github-${response.status}`)
  return response.json()
}

try {
  if (!Number.isFinite(laneMovedAt)) throw new Error("QA deployment wait failed: lane-timestamp")
  if (!repository || !sha || !token || !bypass) throw new Error("QA deployment wait failed: configuration")
  const output = await waitForQaDeployment({
    expectedSha: sha,
    expectedEnvironment,
    laneMovedAt,
    deadline,
    listDeployments: () => github(`/deployments?sha=${sha}&per_page=20`),
    listStatuses: (deploymentId) => github(`/deployments/${deploymentId}/statuses?per_page=20`),
    probeAliasSha: () => probeStableQaAlias({ origin: stableQaOrigin(), bypass }),
  })
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `deployment_id=${output.deploymentId}\nready_at=${output.readyAt}\nprovider_url=${output.providerUrl}\n`)
  }
  console.log(JSON.stringify({ ok: true, ...output }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA deployment wait failed: unknown")
  process.exit(1)
}
