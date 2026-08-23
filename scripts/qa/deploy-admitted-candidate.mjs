#!/usr/bin/env node
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  assertAliasServesAdmittedSha,
  assertExplicitDeployCredential,
  assertExplicitQaDeploymentReady,
  buildExplicitQaDeployRequest,
  buildSanitizedProviderDeployEvidence,
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

async function waitUntilReady({ token, teamId, deploymentId, expectedSha, expectedBranch, deadline, sleep }) {
  while (Date.now() < deadline) {
    const deployment = await vercelApi(`/v13/deployments/${deploymentId}`, { token, teamId })
    if (deployment.readyState === "ERROR" || deployment.readyState === "CANCELED") {
      fail(`ready-state-${deployment.readyState}`)
    }
    if (deployment.readyState === "READY") {
      return assertExplicitQaDeploymentReady({
        deployment,
        expectedSha,
        expectedBranch,
      })
    }
    await sleep(10_000)
  }
  fail("timeout")
}

async function assignAlias({ token, teamId, deploymentId }) {
  const assignment = buildStableAliasAssignment({ deploymentId })
  await vercelApi(assignment.path, {
    token,
    teamId,
    method: "POST",
    body: assignment.body,
  })
  return assignment
}

try {
  const token = process.env.QA_VERCEL_TOKEN
  const teamId = process.env.QA_VERCEL_TEAM_ID || ""
  const expectedSha = process.env.QA_EXPECTED_SHA
  const candidateBranch = process.env.QA_CANDIDATE_BRANCH
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const evidencePath = process.env.QA_PROVIDER_EVIDENCE_FILE || ".qa-deploy/provider-evidence.json"
  const previousDeploymentId = process.env.QA_PREVIOUS_DEPLOYMENT_ID || ""
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

  if (!SHA_PATTERN.test(expectedSha || "")) fail("candidate-sha")
  if (!candidateBranch) fail("git-ref")
  if (!bypass) fail("bypass")
  assertExplicitDeployCredential({ token, projectId: qaValidationProjectId() })

  // Refuse database secret coexistence in this process.
  for (const forbidden of ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]) {
    if (process.env[forbidden]) fail("secret-coexistence")
  }

  let priorAliasSha = ""
  try {
    priorAliasSha = await probeStableQaAlias({ origin: stableQaOrigin(), bypass })
  } catch {
    priorAliasSha = ""
  }

  const request = buildExplicitQaDeployRequest({
    candidateSha: expectedSha,
    candidateBranch,
  })
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
    expectedBranch: candidateBranch,
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

  const readyAt = new Date().toISOString()
  const evidence = buildSanitizedProviderDeployEvidence({
    deploymentId: ready.deploymentId,
    candidateSha: expectedSha,
    candidateBranch,
    readyState: "READY",
    target: "preview",
    projectId: ready.projectId,
    alias: alias.alias,
    aliasServedSha: servedSha,
    priorAliasSha,
    readyAt,
    providerUrl: ready.url || stableQaOrigin(),
  })

  await mkdir(resolve(evidencePath, ".."), { recursive: true })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `deployment_id=${evidence.deploymentId}`,
        `ready_at=${evidence.readyAt}`,
        `provider_url=${evidence.providerUrl}`,
        `alias=${evidence.alias}`,
        `candidate_sha=${evidence.candidateSha}`,
        `git_ref=${evidence.gitRef}`,
        `evidence_file=${evidencePath}`,
        `prior_alias_sha=${evidence.priorAliasSha}`,
        `rollback_deployment_id=${previousDeploymentId || ""}`,
      ].join("\n") + "\n",
    )
  }

  console.log(JSON.stringify({
    ok: true,
    evidence,
    rollback: previousDeploymentId
      ? { action: "reassign-stable-alias", deploymentId: previousDeploymentId, alias: alias.alias }
      : null,
  }))
} catch (error) {
  console.error(error instanceof Error ? error.message : "QA explicit deploy failed: unknown")
  process.exit(1)
}
