const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const VALIDATION_PROJECT = "renew-overnight-validation-20260820"
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

export function assertProtectedQaBuildEnv(env) {
  const projectRef = env?.QA_SUPABASE_PROJECT_REF
  if (!REF_PATTERN.test(projectRef || "") || projectRef === PRODUCTION_REF) fail("project-ref")
  if (apiRef(env?.NEXT_PUBLIC_SUPABASE_URL) !== projectRef) fail("api-ref")
  if (databaseRef(env?.DATABASE_URL) !== projectRef) fail("database-ref")
  if (env?.QA_MAIL_MODE !== "allowlist" || env?.QA_MAIL_TRANSPORT !== "simulated") fail("mail-policy")
  if (typeof env?.RESEND_API_KEY === "string" && env.RESEND_API_KEY.length > 0) fail("resend-key")

  if (env?.VERCEL_PROJECT_NAME && env.VERCEL_PROJECT_NAME !== VALIDATION_PROJECT) fail("vercel-project-name")
  if (env?.VERCEL_PROJECT_ID) {
    if (!env.QA_VALIDATION_PROJECT_ID || env.VERCEL_PROJECT_ID !== env.QA_VALIDATION_PROJECT_ID) fail("vercel-project-id")
  }

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
})
