const PRODUCTION_SUPABASE_REF = "iiuqcdnmxhtyispnykgf"
const PRODUCTION_HOSTS = new Set([
  "app.re-new.team",
  "re-new.team",
  "v0-re-new-2-0.vercel.app",
])
const VALIDATION_VERCEL_PROJECT = "renew-overnight-validation-20260820"
const RUNNER_ORIGIN = "https://127.0.0.1:3443"

function fail(code) {
  throw new Error(`Isolation preflight failed: ${code}`)
}

function normalizedHttpsOrigin(value, code) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail(code)
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    fail(code)
  }
  return url.origin
}

function supabaseRefFromApiUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail("supabase-ref")
  }
  const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)
  if (url.protocol !== "https:" || !match) fail("supabase-ref")
  return match[1]
}

function supabaseRefFromDatabaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    fail("database-ref")
  }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) fail("database-ref")

  const directHost = url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
  const isSupabasePooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  const pooledUser = isSupabasePooler
    ? decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
    : undefined
  const ref = directHost || pooledUser
  if (!ref) fail("database-ref")
  return ref
}

function isProductionHost(hostname) {
  const host = hostname.toLowerCase()
  return PRODUCTION_HOSTS.has(host) || host.endsWith(".re-new.team")
}

function assertFixtureManifest(manifest, runId, prefix) {
  if (
    manifest?.runId !== runId ||
    manifest?.fixturePrefix !== prefix ||
    !Array.isArray(manifest.databaseRows) ||
    manifest.databaseRows.length === 0 ||
    !Array.isArray(manifest.betterAuthIdentities) ||
    manifest.betterAuthIdentities.length === 0 ||
    !Array.isArray(manifest.storageObjects) ||
    manifest.storageObjects.length === 0 ||
    !Array.isArray(manifest.singletonSnapshots) ||
    manifest.singletonSnapshots.length === 0
  ) {
    fail("fixture-manifest")
  }

  const rowsValid = manifest.databaseRows.every(
    (row) =>
      typeof row?.table === "string" &&
      row.table.length > 0 &&
      typeof row?.id === "string" &&
      row.id.length > 0 &&
      row.label === prefix,
  )
  const identitiesValid = manifest.betterAuthIdentities.every(
    (id) => typeof id === "string" && id.startsWith(`${prefix}-`),
  )
  const storageValid = manifest.storageObjects.every(
    (path) => typeof path === "string" && path.startsWith(`${prefix}/`),
  )
  if (!rowsValid || !identitiesValid || !storageValid) fail("fixture-manifest")
}

export function validateBranchReconstructionEvidence(evidence, expectedRef, { allowInitialMigrationFailure = false } = {}) {
  const acceptedStatuses = new Set(["MIGRATIONS_PASSED", "FUNCTIONS_DEPLOYED"])
  if (allowInitialMigrationFailure) acceptedStatuses.add("MIGRATIONS_FAILED")
  if (
    typeof expectedRef !== "string" ||
    !/^[a-z0-9]{20}$/.test(expectedRef) ||
    expectedRef === PRODUCTION_SUPABASE_REF ||
    evidence?.projectRef !== expectedRef ||
    evidence?.parentProjectRef !== PRODUCTION_SUPABASE_REF ||
    evidence?.isDefault !== false ||
    evidence?.persistent !== true ||
    evidence?.withData !== false ||
    !acceptedStatuses.has(evidence?.status) ||
    evidence?.previewProjectStatus !== "ACTIVE_HEALTHY"
  ) {
    fail("branch-evidence")
  }
  return { projectRef: expectedRef }
}

export function validateIsolationPreflight({ env, evidence, manifest }) {
  const executionMode = env?.QA_EXECUTION_MODE || "vercel"
  const expectedRef = env?.QA_SUPABASE_PROJECT_REF
  if (
    typeof expectedRef !== "string" ||
    !/^[a-z0-9]{20}$/.test(expectedRef) ||
    expectedRef === PRODUCTION_SUPABASE_REF
  ) {
    fail("supabase-ref")
  }

  const apiRef = supabaseRefFromApiUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  if (apiRef !== expectedRef) fail("supabase-ref")
  if (supabaseRefFromDatabaseUrl(env.DATABASE_URL) !== expectedRef) fail("database-ref")

  const originValues = [
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.QA_BROWSER_BASE_URL,
    env.QA_VALIDATION_ORIGIN,
  ].map((value) => normalizedHttpsOrigin(value, "validation-origin"))
  if (new Set(originValues).size !== 1) fail("validation-origin")
  const origin = originValues[0]
  if (isProductionHost(new URL(origin).hostname)) fail("production-origin")

  const probes = evidence?.supabase
  if (
    probes?.databaseRef !== expectedRef ||
    probes?.apiRef !== expectedRef ||
    probes?.storageRef !== expectedRef
  ) {
    fail("supabase-probes")
  }

  if (executionMode === "github-runner") {
    const runtime = evidence?.runtime
    if (origin !== RUNNER_ORIGIN || runtime?.origin !== RUNNER_ORIGIN) fail("runner-origin")
    if (runtime?.provider !== "github-runner") fail("runner-provider")
    if (runtime?.candidateSha !== env?.QA_EXPECTED_SHA || !/^[0-9a-f]{40}$/.test(runtime?.candidateSha || "")) fail("runner-sha")
    if (runtime?.loopbackOnly !== true) fail("runner-loopback")
    if (runtime?.productionEnvironmentAttached !== false) fail("runner-production-environment")
    if (runtime?.authorizedStatus !== 200) fail("runner-status")
  } else if (executionMode === "vercel") {
    const vercel = evidence?.vercel
    if (vercel?.projectName !== VALIDATION_VERCEL_PROJECT) fail("vercel-project")
    if (vercel?.target !== null) fail("vercel-target")
    if (vercel?.productionEnvironmentAttached !== false) {
      fail("vercel-production-environment")
    }
    if (!Array.isArray(vercel.aliases)) fail("vercel-alias")
    for (const alias of vercel.aliases) {
      let hostname
      try {
        hostname = new URL(alias.includes("://") ? alias : `https://${alias}`).hostname
      } catch {
        fail("vercel-alias")
      }
      if (isProductionHost(hostname)) fail("vercel-alias")
    }
  } else {
    fail("execution-mode")
  }

  const recipient = env?.QA_EMAIL_RECIPIENT?.toLowerCase()
  const allowedRecipients = evidence?.email?.allowedRecipients
  if (
    typeof recipient !== "string" ||
    !Array.isArray(allowedRecipients) ||
    !allowedRecipients.map((value) => value.toLowerCase()).includes(recipient) ||
    !recipient.endsWith("@resend.dev") ||
    evidence?.email?.applicationPolicy !== "allowlist" ||
    evidence?.email?.applicationTransport !== "simulated"
  ) {
    fail("email-recipient")
  }

  const runId = env?.QA_RUN_ID
  const fixturePrefix = env?.QA_FIXTURE_PREFIX
  if (
    typeof runId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(runId) ||
    fixturePrefix !== `TEST-${runId}`
  ) {
    fail("fixture-prefix")
  }
  assertFixtureManifest(manifest, runId, fixturePrefix)

  return { projectRef: expectedRef, origin, runId }
}
