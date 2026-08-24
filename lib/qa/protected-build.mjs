const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const VALIDATION_PROJECT = "renew-overnight-validation-20260820"
const VALIDATION_PROJECT_ID = "prj_btAdxukLqgJ3vIBaQ6m2OW9XkR4Y"
const REF_PATTERN = /^[a-z0-9]{20}$/

function fail(code) {
  throw new Error(`Protected QA build failed: ${code}`)
}

function apiRef(value) {
  try {
    const url = new URL(value || "")
    if (url.protocol !== "https:") fail("api-ref")
    return url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1]
  } catch {
    fail("api-ref")
  }
}

function databaseRef(value) {
  try {
    const url = new URL(value || "")
    if (!/^postgres(?:ql)?:$/.test(url.protocol)) fail("database-ref")
    const direct = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
    const pooled = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
      ? decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
      : undefined
    return direct || pooled
  } catch {
    fail("database-ref")
  }
}

export function assertQaBuildEnv(env) {
  const projectName = env?.VERCEL_PROJECT_NAME
  const projectId = env?.VERCEL_PROJECT_ID
  const hasProjectName = typeof projectName === "string" && projectName.length > 0
  const hasProjectId = typeof projectId === "string" && projectId.length > 0
  const isValidationProjectName = projectName === VALIDATION_PROJECT
  const isValidationProjectId = projectId === VALIDATION_PROJECT_ID
  const protectedMode = env?.QA_CONTRACT_MODE === "protected"
  const runnerMode = env?.QA_EXECUTION_MODE === "github-runner"

  if ((isValidationProjectName || isValidationProjectId) && !protectedMode) fail("contract-mode")
  if (hasProjectName !== hasProjectId) fail("vercel-project-metadata")
  if (!protectedMode) return null
  if (runnerMode) {
    if (hasProjectName || hasProjectId) fail("runner-vercel-metadata")
  } else {
    if (!hasProjectName || !hasProjectId) fail("vercel-project-metadata")
    if (!isValidationProjectName) fail("vercel-project-name")
    if (!isValidationProjectId) fail("vercel-project-id")
  }

  const projectRef = env?.QA_SUPABASE_PROJECT_REF
  if (!REF_PATTERN.test(projectRef || "") || projectRef === PRODUCTION_REF) fail("project-ref")
  if (apiRef(env?.NEXT_PUBLIC_SUPABASE_URL) !== projectRef) fail("api-ref")
  if (databaseRef(env?.DATABASE_URL) !== projectRef) fail("database-ref")
  if (env?.QA_MAIL_MODE !== "allowlist" || env?.QA_MAIL_TRANSPORT !== "simulated") fail("mail-policy")
  if (typeof env?.RESEND_API_KEY === "string" && env.RESEND_API_KEY.length > 0) fail("resend-key")

  return {
    projectRef,
    validationProject: VALIDATION_PROJECT,
    mailPolicy: "allowlist",
    mailTransport: "simulated",
  }
}

export const PROTECTED_QA_BUILD = Object.freeze({
  productionRef: PRODUCTION_REF,
  validationProject: VALIDATION_PROJECT,
  validationProjectId: VALIDATION_PROJECT_ID,
})
