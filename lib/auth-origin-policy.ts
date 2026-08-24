export const RENEW_PRODUCTION_ORIGIN = "https://app.re-new.team"

/**
 * Owned by the protected `renew-overnight-validation-20260820` Vercel project.
 * Remove this origin only when that permanent QA lane and its workflows are
 * retired together; never replace it with a shared-hosting suffix rule.
 */
export const RENEW_PROTECTED_QA_ORIGIN =
  "https://renew-overnight-validation-git-59fa20-myworkmail4-pngs-projects.vercel.app"

type RuntimeEnvironment = "development" | "production" | "test"

const OWNED_DEPLOYMENT_ORIGINS = new Set([
  RENEW_PRODUCTION_ORIGIN,
  RENEW_PROTECTED_QA_ORIGIN,
])

const LOCAL_VERIFICATION_ORIGINS = new Set([
  "http://localhost:3000",
  "https://127.0.0.1:3443",
])

function normalizedOrigin(value: string) {
  try {
    const parsed = new URL(value)
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("origin-only URL required")
    }
    return parsed.origin
  } catch {
    throw new Error("Auth origin rejected")
  }
}

function isAllowedConfiguredOrigin(
  origin: string,
  runtime: RuntimeEnvironment,
  qaContractMode?: "protected",
) {
  return (
    OWNED_DEPLOYMENT_ORIGINS.has(origin) ||
    (runtime !== "production" && LOCAL_VERIFICATION_ORIGINS.has(origin)) ||
    (qaContractMode === "protected" && origin === "https://127.0.0.1:3443")
  )
}

export function trustedAuthOrigins(
  configuredOrigin: string,
  runtime: RuntimeEnvironment,
  qaContractMode?: "protected",
) {
  const configured = normalizedOrigin(configuredOrigin)
  if (!isAllowedConfiguredOrigin(configured, runtime, qaContractMode)) {
    throw new Error("Auth origin rejected")
  }
  return [...new Set([configured, RENEW_PRODUCTION_ORIGIN])]
}

export function validatePasswordResetDeliveryUrl(
  rawUrl: string,
  configuredOrigin: string,
  runtime: RuntimeEnvironment,
  qaContractMode?: "protected",
) {
  const allowedOrigins = new Set(
    trustedAuthOrigins(configuredOrigin, runtime, qaContractMode),
  )
  let resetUrl: URL
  try {
    resetUrl = new URL(rawUrl)
  } catch {
    throw new Error("Password reset URL rejected")
  }

  if (!allowedOrigins.has(resetUrl.origin)) {
    throw new Error("Password reset URL rejected")
  }

  if (
    resetUrl.username ||
    resetUrl.password ||
    resetUrl.hash ||
    !/^\/api\/auth\/reset-password\/[^/]+$/.test(resetUrl.pathname)
  ) {
    throw new Error("Password reset URL rejected")
  }

  const callbackValues = resetUrl.searchParams.getAll("callbackURL")
  if (callbackValues.length !== 1 || !callbackValues[0]) {
    throw new Error("Password reset URL rejected")
  }
  const callbackValue = callbackValues[0]

  let callback: URL
  try {
    callback = new URL(callbackValue, resetUrl.origin)
  } catch {
    throw new Error("Password reset URL rejected")
  }

  if (
    !allowedOrigins.has(callback.origin) ||
    callback.pathname !== "/auth/reset-password" ||
    callback.username ||
    callback.password ||
    callback.hash
  ) {
    throw new Error("Password reset URL rejected")
  }

  return resetUrl.toString()
}
