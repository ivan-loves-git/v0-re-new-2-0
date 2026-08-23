import { PROTECTED_QA_BUILD } from "./protected-build.mjs"
import { QA_CONTRACT, stableQaOrigin } from "./permanent-contract.mjs"

const SHA_PATTERN = /^[0-9a-f]{40}$/
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/
const GIT_REF = "qa"
const PRODUCT_PROJECT = "v0-re-new-2-0"
const CONTROLLER_META_KEY = "renewQaController"
const CONTROLLER_META_VALUE = "explicit-v1"

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

/**
 * @param {{
 *   candidateSha: string,
 *   repository?: string,
 *   gitRef?: string,
 *   projectId?: string,
 *   projectName?: string,
 * }} input
 */
export function buildExplicitQaDeployRequest({
  candidateSha,
  repository = QA_CONTRACT.repository,
  gitRef = GIT_REF,
  projectId = qaValidationProjectId(),
  projectName = qaValidationProjectName(),
}) {
  if (!SHA_PATTERN.test(candidateSha || "")) fail("candidate-sha")
  if (repository !== QA_CONTRACT.repository) fail("repository")
  if (gitRef !== GIT_REF) fail("git-ref")
  if (projectId !== PROTECTED_QA_BUILD.validationProjectId) fail("project-id")
  if (projectName !== PROTECTED_QA_BUILD.validationProject) fail("project-name")

  const [org, repo] = repository.split("/")
  return {
    name: projectName,
    project: projectId,
    target: "preview",
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
    target: deployment?.target,
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
  expectedProjectId = PROTECTED_QA_BUILD.validationProjectId,
  expectedRef = GIT_REF,
}) {
  if (!SHA_PATTERN.test(expectedSha || "")) fail("candidate-sha")
  const identity = extractDeploymentIdentity(deployment)
  if (!DEPLOYMENT_ID_PATTERN.test(identity.deploymentId || "")) fail("deployment-id")
  if (identity.projectId !== expectedProjectId) fail("project-id")
  if (identity.target !== "preview" && identity.target !== null && identity.target !== undefined) {
    // Vercel may omit target on some payloads; reject only explicit production.
    if (identity.target === "production") fail("target")
  }
  if (deployment?.target === "production" || deployment?.productionEnvironment === true) fail("production-target")
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
    alias,
    deploymentId,
    redirect: null,
  }
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
    note: "Reassign the preserved stable alias to the prior READY non-production deployment. Do not reconnect automatic Git until a reviewed rollback restores the legacy waiter.",
  }
}

/**
 * Pressure-test helper: ordinary source-repo pushes must create zero validation
 * deployments once the validation project is disconnected from automatic Git.
 */
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

/**
 * One admitted candidate must create exactly one validation deployment for the
 * explicit controller request.
 */
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

export const EXPLICIT_QA_DEPLOY = Object.freeze({
  gitRef: GIT_REF,
  controllerMetaKey: CONTROLLER_META_KEY,
  controllerMetaValue: CONTROLLER_META_VALUE,
  productProject: PRODUCT_PROJECT,
})
