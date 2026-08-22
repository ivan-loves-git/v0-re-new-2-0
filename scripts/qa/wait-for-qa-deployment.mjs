#!/usr/bin/env node
import { appendFile } from "node:fs/promises"

const repository = process.env.GITHUB_REPOSITORY
const sha = process.env.QA_EXPECTED_SHA
const token = process.env.GITHUB_TOKEN
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
  while (Date.now() < deadline) {
    const deployments = await github(`/deployments?sha=${sha}&per_page=20`)
    const deployment = deployments.find((item) => item.sha === sha && item.environment === expectedEnvironment && item.creator?.login === "vercel[bot]" && item.production_environment === false && Date.parse(item.created_at) >= laneMovedAt)
    if (deployment) {
      const statuses = await github(`/deployments/${deployment.id}/statuses?per_page=20`)
      const ready = statuses.find((item) => item.state === "success" && item.creator?.login === "vercel[bot]")
      if (ready) {
        const output = {
          deploymentId: deployment.id,
          readyAt: ready.created_at,
          providerUrl: ready.environment_url,
        }
        if (process.env.GITHUB_OUTPUT) {
          await appendFile(process.env.GITHUB_OUTPUT, `deployment_id=${output.deploymentId}\nready_at=${output.readyAt}\nprovider_url=${output.providerUrl}\n`)
        }
        console.log(JSON.stringify({ ok: true, ...output }))
        process.exit(0)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
  throw new Error("QA deployment wait failed: timeout")
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA deployment wait failed: unknown")
  process.exit(1)
}
