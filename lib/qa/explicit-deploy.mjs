import { PROTECTED_QA_BUILD } from "./protected-build.mjs"
import { QA_CONTRACT, stableQaOrigin } from "./permanent-contract.mjs"

const SHA_PATTERN = /^[0-9a-f]{40}$/
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/
const BRANCH_PATTERN = /^(?!\/)(?!.*\.\.)(?!.*(?:^|\/)\.)(?!.*[~^:?*\\\[\]])[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/
const PRODUCT_PROJECT = "v0-re-new-2-0"
const CONTROLLER_META_KEY = "renewQaController"
const CONTROLLER_META_VALUE = "explicit-v1"
const FORBIDDEN_GIT_REFS = new Set(["qa", "main", "master", "production", "prod"])

function fail(code) {
  throw new Error(`QA explicit deploy failed: ${code}`)
}

export function qaValidationProjectId() {
  return PROTECTED_QA_BUILD.validationProjectId
}

export function qaValidationProjectName() {
  return PROTECTED_QA_BUILD.validationProject
}

export function qaStableAliasHostname() {
  return QA_CONTRACT.stableAlias
}

export function assertAdmittedCandidateGitRef(gitRef) {
  if (!BRANCH_PATTERN.test(gitRef || "") || FORBIDDEN_GIT_REFS.has(gitRef)) fail("git-ref")
  return gitRef
}

/**
 * @param {{
 *   candidateSha: string,
 *   candidateBranch: string,
 *   repository?: string,
 *   projectId?: string,
 *   projectName?: string,
 * }} input
 */
export function buildExplicitQaDeployRequest({
  candidateSha,
  candidateBranch,
  repository = QA_CONTRACT.repository,
  projectId = qaValidationProjectId(),
  projectName = qaValidationProjectName(),
}) {
  if (!SHA_PATTERN.test(candidateSha || "")) fail("candidate-sha")
  if (repository !== QA_CONTRACT.repository) fail("repository")
  const gitRef = assertAdmittedCandidateGitRef(candidateBranch)
  if (projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  if (projectName !== PROTECTED_QA_BUILD.validationProject) fail("project-name")

  const [org, repo] = repository.split("/")
  // After Git disconnect, Vercel rejects target:"preview" on Deployment API creates.
  // Omit target so the provider creates a non-production deployment (target null).
  return {
    name: projectName,
    project: projectId,
    gitSource: {
      type: "github",
      org,
      repo,
      ref: gitRef,
      sha: candidateSha,
    },
    gitMetadata: {
      commitRef: gitRef,
      commitSha: candidateSha,
      remoteUrl: `https://github.com/${repository}.git`,
      dirty: false,
      ci: true,
      ciType: "github-actions",
    },
    meta: {
      githubCommitSha: candidateSha,
      githubCommitRef: gitRef,
      [CONTROLLER_META_KEY]: CONTROLLER_META_VALUE,
    },
  }
}

/**
 * @param {{ token: string, projectId: string }} input
 */
export function assertExplicitDeployCredential({ token, projectId }) {
  if (typeof token !== "string" || token.trim().length < 20) fail("token")
  if (projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  return true
}

export function extractDeploymentIdentity(deployment) {
  const id = deployment?.id || deployment?.uid
  const meta = deployment?.meta || {}
  const gitSource = deployment?.gitSource || {}
  return {
    deploymentId: id,
    projectId: deployment?.projectId,
    readyState: deployment?.readyState,
    target: deployment?.target || null,
    metaGithubCommitSha: typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : "",
    metaGithubCommitRef: meta.githubCommitRef || gitSource.ref || "",
    gitSourceSha: gitSource.sha || "",
    gitSourceRef: gitSource.ref || "",
    controller: meta[CONTROLLER_META_KEY] || "",
    url: deployment?.url ? `https://${deployment.url}` : "",
  }
}

export function assertExplicitQaDeploymentReady({
  deployment,
  expectedSha,
  expectedBranch,
  expectedProjectId = PROTECTED_QA_BUILD.validationProjectId,
}) {
  if (!SHA_PATTERN.test(expectedSha || "")) fail("candidate-sha")
  const expectedRef = assertAdmittedCandidateGitRef(expectedBranch)
  const identity = extractDeploymentIdentity(deployment)
  if (!DEPLOYMENT_ID_PATTERN.test(identity.deploymentId || "")) fail("deployment-id")
  if (identity.projectId !== expectedProjectId) fail("project-id")
  if (deployment?.productionEnvironment === true) fail("production-target")
  // Post-disconnect Deployment API returns target=null. Fail closed on any other value
  // (including preview/staging/production); do not accept arbitrary non-production targets.
  if (deployment?.target !== null) fail("target")
  if (identity.readyState !== "READY") fail("ready-state")
  if (identity.metaGithubCommitSha !== expectedSha && identity.gitSourceSha !== expectedSha) fail("commit-sha")
  if (identity.metaGithubCommitRef !== expectedRef && identity.gitSourceRef !== expectedRef) fail("git-ref")
  if (identity.controller !== CONTROLLER_META_VALUE) fail("controller-meta")
  return identity
}

/**
 * @param {{ deploymentId: string, alias?: string }} input
 */
export function buildStableAliasAssignment({
  deploymentId,
  alias = qaStableAliasHostname(),
}) {
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId || "")) fail("deployment-id")
  if (alias !== QA_CONTRACT.stableAlias) fail("alias")
  return {
    // POST /v2/deployments/:id/aliases — /v2/aliases is not accepted for this project token.
    path: `/v2/deployments/${deploymentId}/aliases`,
    body: { alias },
    alias,
    deploymentId,
    redirect: null,
  }
}

export function buildSanitizedProviderDeployEvidence({
  deploymentId,
  candidateSha,
  candidateBranch,
  readyState = "READY",
  target = null,
  projectId = qaValidationProjectId(),
  projectName = qaValidationProjectName(),
  alias = qaStableAliasHostname(),
  aliasServedSha,
  priorAliasSha = "",
  readyAt,
  providerUrl = "",
}) {
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId || "")) fail("deployment-id")
  if (!SHA_PATTERN.test(candidateSha || "") || aliasServedSha !== candidateSha) fail("alias-sha")
  const gitRef = assertAdmittedCandidateGitRef(candidateBranch)
  if (projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  if (projectName !== PROTECTED_QA_BUILD.validationProject) fail("project-name")
  if (target !== null) fail("target")
  if (readyState !== "READY") fail("ready-state")
  if (alias !== QA_CONTRACT.stableAlias) fail("alias")
  if (typeof readyAt !== "string" || !Number.isFinite(Date.parse(readyAt))) fail("ready-at")
  return {
    deploymentId,
    projectId,
    projectName,
    gitRef,
    candidateSha,
    target: null,
    readyState,
    alias,
    aliasOrigin: stableQaOrigin(),
    aliasServedSha,
    priorAliasSha: SHA_PATTERN.test(priorAliasSha || "") ? priorAliasSha : "",
    readyAt,
    providerUrl,
    controller: CONTROLLER_META_VALUE,
  }
}

export function assertSanitizedProviderDeployEvidence(evidence, expected = {}) {
  if (!evidence || typeof evidence !== "object") fail("evidence")
  if (evidence.deploymentId !== expected.deploymentId && expected.deploymentId) fail("deployment-id")
  if (evidence.candidateSha !== expected.candidateSha) fail("candidate-sha")
  if (evidence.gitRef !== expected.candidateBranch) fail("git-ref")
  if (evidence.projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  if (evidence.projectName !== PROTECTED_QA_BUILD.validationProject) fail("project-name")
  if (evidence.target !== null) fail("target")
  if (evidence.readyState !== "READY") fail("ready-state")
  if (evidence.alias !== QA_CONTRACT.stableAlias || evidence.aliasOrigin !== stableQaOrigin()) fail("alias")
  if (evidence.aliasServedSha !== expected.candidateSha) fail("alias-sha")
  if (evidence.controller !== CONTROLLER_META_VALUE) fail("controller-meta")
  if (JSON.stringify(evidence).includes("QA_VERCEL_TOKEN") || JSON.stringify(evidence).includes("Bearer ")) fail("secret-residue")
  return evidence
}

export function buildExplicitDeployRollback({
  previousDeploymentId,
  alias = qaStableAliasHostname(),
}) {
  if (!DEPLOYMENT_ID_PATTERN.test(previousDeploymentId || "")) fail("previous-deployment-id")
  if (alias !== QA_CONTRACT.stableAlias) fail("alias")
  return {
    action: "reassign-stable-alias",
    alias,
    deploymentId: previousDeploymentId,
    reconnectGit: false,
    note: "Reassign the preserved stable alias to the prior READY non-production deployment. Do not reconnect automatic Git until a reviewed rollback restores a prior controller.",
  }
}

export function assertOrdinaryPushCreatesNoValidationDeploy({
  sourceRepositoryPush,
  validationProjectDeployments,
  productProjectDeployments,
}) {
  if (sourceRepositoryPush !== true) fail("source-push")
  if (!Array.isArray(validationProjectDeployments) || validationProjectDeployments.length !== 0) {
    fail("validation-deploy-count")
  }
  if (!Array.isArray(productProjectDeployments)) fail("product-deployments")
  if (productProjectDeployments.some((deployment) => deployment?.name === PROTECTED_QA_BUILD.validationProject || deployment?.projectId === PROTECTED_QA_BUILD.validationProjectId)) {
    fail("validation-project-leak")
  }
  return {
    validationDeployments: 0,
    productDeployments: productProjectDeployments.length,
    productProject: PRODUCT_PROJECT,
  }
}

export function assertOneValidationDeployPerCandidate({
  admittedCandidate,
  createdDeployments,
  expectedSha,
}) {
  if (admittedCandidate !== true) fail("admission")
  if (!SHA_PATTERN.test(expectedSha || "")) fail("candidate-sha")
  if (!Array.isArray(createdDeployments) || createdDeployments.length !== 1) fail("deploy-count")
  const [deployment] = createdDeployments
  const identity = extractDeploymentIdentity(deployment)
  if (identity.metaGithubCommitSha !== expectedSha && identity.gitSourceSha !== expectedSha) fail("commit-sha")
  if (identity.projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  return { deploymentId: identity.deploymentId, candidateSha: expectedSha }
}

export function assertAliasServesAdmittedSha({
  aliasOrigin,
  servedSha,
  expectedSha,
}) {
  if (aliasOrigin !== stableQaOrigin()) fail("alias-origin")
  if (!SHA_PATTERN.test(expectedSha || "") || servedSha !== expectedSha) fail("alias-sha")
  return { origin: aliasOrigin, candidateSha: expectedSha }
}

export function assertJobSecretIsolation({ jobName, envKeys }) {
  if (!Array.isArray(envKeys)) fail("env-keys")
  const keys = new Set(envKeys)
  const hasVercelToken = keys.has("QA_VERCEL_TOKEN")
  const hasDatabase = ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].some((key) => keys.has(key))
  if (jobName === "deploy-qa") {
    if (!hasVercelToken) fail("deploy-token")
    if (hasDatabase) fail("secret-coexistence")
    return { jobName, vercelToken: true, databaseSecrets: false }
  }
  if (hasVercelToken && hasDatabase) fail("secret-coexistence")
  if (hasVercelToken) fail("vercel-token-scope")
  return { jobName, vercelToken: false, databaseSecrets: hasDatabase }
}

export const EXPLICIT_QA_DEPLOY = Object.freeze({
  controllerMetaKey: CONTROLLER_META_KEY,
  controllerMetaValue: CONTROLLER_META_VALUE,
  productProject: PRODUCT_PROJECT,
  forbiddenGitRefs: [...FORBIDDEN_GIT_REFS],
})
