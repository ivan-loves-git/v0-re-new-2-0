#!/usr/bin/env node
import { appendFile } from "node:fs/promises"
import {
  assertAliasServesAdmittedSha,
  assertExplicitDeployCredential,
  assertExplicitQaDeploymentReady,
  buildExplicitQaDeployRequest,
  buildStableAliasAssignment,
  extractDeploymentIdentity,
  qaValidationProjectId,
} from "../../lib/qa/explicit-deploy.mjs"
import {
  probeStableQaAlias,
} from "../../lib/qa/deployment-status.mjs"
import { stableQaOrigin } from "../../lib/qa/permanent-contract.mjs"

const SHA_PATTERN = /^[0-9a-f]{40}$/

function fail(code) {
  throw new Error(`QA explicit deploy failed: ${code}`)
}

async function vercelApi(path, { token, teamId, method = "GET", body } = {}) {
  const url = new URL(`https://api.vercel.com${path}`)
  if (teamId) url.searchParams.set("teamId", teamId)
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }
  if (!response.ok) {
    const code = payload?.error?.code || payload?.error?.message || `http-${response.status}`
    fail(`provider-${String(code).slice(0, 80)}`)
  }
  return payload
}

async function waitUntilReady({ token, teamId, deploymentId, expectedSha, deadline, sleep }) {
  while (Date.now() < deadline) {
    const deployment = await vercelApi(`/v13/deployments/${deploymentId}`, { token, teamId })
    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      fail(`ready-state-${deployment.readyState}`)
    }
    if (deployment.readyState === "READY") {
      return assertExplicitQaDeploymentReady({ deployment, expectedSha })
    }
    await sleep(10_000)
  }
  fail("timeout")
}

async function assignAlias({ token, teamId, deploymentId }) {
  const assignment = buildStableAliasAssignment({ deploymentId })
  await vercelApi("/v2/aliases", {
    token,
    teamId,
    method: "POST",
    body: {
      alias: assignment.alias,
      deploymentId: assignment.deploymentId,
    },
  })
  return assignment
}

try {
  const token = process.env.QA_VERCEL_TOKEN
  const teamId = process.env.QA_VERCEL_TEAM_ID || ""
  const expectedSha = process.env.QA_EXPECTED_SHA
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const previousDeploymentId = process.env.QA_PREVIOUS_DEPLOYMENT_ID || ""
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

  if (!SHA_PATTERN.test(expectedSha || "")) fail("candidate-sha")
  if (!bypass) fail("bypass")
  assertExplicitDeployCredential({ token, projectId: qaValidationProjectId() })

  // Capture the currently aliased deployment for reviewed rollback evidence.
  let priorAliasSha = ""
  try {
    priorAliasSha = await probeStableQaAlias({ origin: stableQaOrigin(), bypass })
  } catch {
    priorAliasSha = ""
  }

  const request = buildExplicitQaDeployRequest({ candidateSha: expectedSha })
  const created = await vercelApi("/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1", {
    token,
    teamId: teamId || undefined,
    method: "POST",
    body: request,
  })
  const createdIdentity = extractDeploymentIdentity(created)
  if (!createdIdentity.deploymentId) fail("deployment-id")

  const ready = await waitUntilReady({
    token,
    teamId: teamId || undefined,
    deploymentId: createdIdentity.deploymentId,
    expectedSha,
    deadline: Date.now() + 8 * 60 * 1000,
    sleep,
  })

  const alias = await assignAlias({
    token,
    teamId: teamId || undefined,
    deploymentId: ready.deploymentId,
  })

  const servedSha = await probeStableQaAlias({ origin: stableQaOrigin(), bypass })
  assertAliasServesAdmittedSha({
    aliasOrigin: stableQaOrigin(),
    servedSha,
    expectedSha,
  })

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `deployment_id=${ready.deploymentId}`,
        `ready_at=${new Date().toISOString()}`,
        `provider_url=${ready.url || stableQaOrigin()}`,
        `alias=${alias.alias}`,
        `prior_alias_sha=${priorAliasSha}`,
        `rollback_deployment_id=${previousDeploymentId || ""}`,
      ].join("\n") + "\n",
    )
  }

  console.log(JSON.stringify({
    ok: true,
    deploymentId: ready.deploymentId,
    candidateSha: expectedSha,
    projectId: ready.projectId,
    gitRef: ready.metaGithubCommitRef || ready.gitSourceRef,
    metaGithubCommitSha: ready.metaGithubCommitSha || ready.gitSourceSha,
    alias: alias.alias,
    priorAliasSha,
    rollback: previousDeploymentId
      ? { action: "reassign-stable-alias", deploymentId: previousDeploymentId, alias: alias.alias }
      : null,
  }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA explicit deploy failed: unknown")
  process.exit(1)
}
