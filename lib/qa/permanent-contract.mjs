const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const REPOSITORY = "ivan-loves-git/v0-re-new-2-0"
const VALIDATION_PROJECT = "renew-overnight-validation-20260820"
const QA_ALIAS = "renew-overnight-validation-git-qa-myworkmail4-pngs-projects.vercel.app"
const SHA_PATTERN = /^[0-9a-f]{40}$/
const REF_PATTERN = /^[a-z0-9]{20}$/
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/
const BRANCH_PATTERN = /^(?!\/)(?!.*\.\.)(?!.*(?:^|\/)\.)(?!.*[~^:?*\\\[\]])[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/

function fail(code) {
  throw new Error(`QA contract failed: ${code}`)
}

export function stableQaOrigin() {
  return `https://${QA_ALIAS}`
}

export function buildQaContract({ projectRef, candidateSha, structureFingerprint }) {
  if (!REF_PATTERN.test(projectRef || "") || projectRef === PRODUCTION_REF) fail("project-ref")
  if (!SHA_PATTERN.test(candidateSha || "")) fail("candidate-sha")
  if (!FINGERPRINT_PATTERN.test(structureFingerprint || "") || /^0{64}$/.test(structureFingerprint)) fail("structure-fingerprint")
  return {
    candidateSha,
    projectRef,
    structureFingerprint,
    validationProject: VALIDATION_PROJECT,
  }
}

export function assertDeployedQaContract(expected, actual) {
  if (actual?.origin !== stableQaOrigin()) fail("origin")
  if (actual?.candidateSha !== expected?.candidateSha) fail("candidate-sha")
  if (actual?.projectRef !== expected?.projectRef || actual.projectRef === PRODUCTION_REF) fail("project-ref")
  if (actual?.apiRef !== expected?.projectRef || actual?.databaseRef !== expected?.projectRef || actual?.storageRef !== expected?.projectRef) fail("deployed-backend-ref")
  if (actual?.structureFingerprint !== expected?.structureFingerprint) fail("structure-fingerprint")
  if (actual?.validationProject !== VALIDATION_PROJECT || actual.validationProject !== expected?.validationProject) fail("validation-project")
  if (actual?.mailPolicy !== "allowlist" || actual?.mailTransport !== "simulated") fail("mail-policy")
  return actual
}

export function assertCandidatePointer({ repository, candidateBranch, candidateSha, branchHeadSha }) {
  if (repository !== REPOSITORY) throw new Error("QA candidate failed: repository")
  if (!BRANCH_PATTERN.test(candidateBranch || "") || candidateBranch === "qa") throw new Error("QA candidate failed: branch")
  if (!SHA_PATTERN.test(candidateSha || "") || branchHeadSha !== candidateSha) throw new Error("QA candidate failed: sha")
  return { candidateBranch, candidateSha }
}

export function assertAuthorizedCandidate({ controllerRef, controllerSha, mainSha, actorPermission, pull, verifyCheck, candidateBranch, candidateSha }) {
  if (controllerRef !== "refs/heads/main" || controllerSha !== mainSha) throw new Error("QA candidate failed: controller")
  if (!new Set(["admin", "maintain", "write"]).has(actorPermission)) throw new Error("QA candidate failed: actor-permission")
  if (pull?.base?.ref !== "main" || pull?.head?.ref !== candidateBranch || pull?.head?.sha !== candidateSha || pull?.head?.repo?.full_name !== REPOSITORY || pull?.draft !== false) {
    throw new Error("QA candidate failed: pull-request")
  }
  if (verifyCheck?.name !== "Verify" || verifyCheck?.conclusion !== "success" || verifyCheck?.head_sha !== candidateSha) {
    throw new Error("QA candidate failed: verify-check")
  }
  return { candidateBranch, candidateSha }
}

export const QA_CONTRACT = Object.freeze({
  productionRef: PRODUCTION_REF,
  repository: REPOSITORY,
  stableAlias: QA_ALIAS,
  validationProject: VALIDATION_PROJECT,
})
