export const RENEW_PRODUCTION_ORIGIN = "https://app.re-new.team"

type RuntimeEnvironment = "development" | "production" | "test"

interface TrustedAuthOriginInput {
  betterAuthUrl: string
  betterAuthTrustedOrigins?: string
  nodeEnv: RuntimeEnvironment
  vercelUrl?: string
  vercelBranchUrl?: string
  vercelProjectProductionUrl?: string
}

const REJECTED_ORIGIN_MESSAGE = "Auth origin rejected"

function rejectOrigin(): never {
  throw new Error(REJECTED_ORIGIN_MESSAGE)
}

function parseOriginOnly(value: string) {
  if (value.includes("*") || value.includes("?")) return rejectOrigin()

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return rejectOrigin()
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return rejectOrigin()
  }

  return url
}

function isLoopbackHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  )
}

function isRenewHost(hostname: string) {
  return hostname === "re-new.team" || hostname.endsWith(".re-new.team")
}

function configuredOrigin(value: string, nodeEnv: RuntimeEnvironment) {
  const url = parseOriginOnly(value)

  if (url.protocol === "https:" && isRenewHost(url.hostname)) {
    return url.origin
  }

  if (nodeEnv !== "production" && isLoopbackHost(url.hostname)) {
    return url.origin
  }

  return rejectOrigin()
}

function vercelDeploymentOrigin(
  value: string | undefined,
  options: { allowRenewCustomDomain?: boolean } = {},
) {
  if (!value) return null

  const url = parseOriginOnly(value.includes("://") ? value : `https://${value}`)
  const isVercelDeployment =
    url.hostname !== "vercel.app" && url.hostname.endsWith(".vercel.app")
  const isRenewProductionDomain =
    options.allowRenewCustomDomain && isRenewHost(url.hostname)

  if (
    url.protocol !== "https:" ||
    url.port ||
    (!isVercelDeployment && !isRenewProductionDomain)
  ) {
    return rejectOrigin()
  }

  return url.origin
}

export function trustedAuthOrigins(input: TrustedAuthOriginInput) {
  // Better Auth also reads this variable directly. Reject it instead of
  // letting a wildcard or stale deployment URL silently broaden this policy.
  if (input.betterAuthTrustedOrigins?.trim()) return rejectOrigin()

  const origins = new Set([
    RENEW_PRODUCTION_ORIGIN,
    configuredOrigin(input.betterAuthUrl, input.nodeEnv),
  ])

  for (const candidate of [input.vercelUrl, input.vercelBranchUrl]) {
    const origin = vercelDeploymentOrigin(candidate)
    if (origin) origins.add(origin)
  }

  const productionOrigin = vercelDeploymentOrigin(
    input.vercelProjectProductionUrl,
    { allowRenewCustomDomain: true },
  )
  if (productionOrigin) origins.add(productionOrigin)

  return [...origins]
}
