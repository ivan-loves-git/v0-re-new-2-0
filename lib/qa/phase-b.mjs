import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { QA_CONTRACT, assertDeployedQaContract, buildQaContract, stableQaOrigin } from "./permanent-contract.mjs"

const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const VALIDATION_PROJECT = "renew-overnight-validation-20260820"
const RUNNER_ORIGIN = "https://127.0.0.1:3443"
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/
const LEGACY_RECOVERY_RUN_ID = "32720805410-1"
const LEGACY_RECOVERY_MANIFEST_SHA256 = "4d3a6083067be3e324476c289bc08c4aa05df1743227e8cbe351477d9c261807"


function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Fixture manifest failed: canonical-json")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]"
  if (Object.getPrototypeOf(value) === Object.prototype) {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}"
  }
  throw new Error("Fixture manifest failed: canonical-json")
}

function fail(code) {
  throw new Error(`Live QA evidence failed: ${code}`)
}

function stableUuid(runId, key) {
  const hex = createHash("sha256").update(`${runId}:${key}`).digest("hex").slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

function row(table, id, fixturePrefix) {
  return { table, id, label: fixturePrefix }
}

export function buildFixtureManifest(runId) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("Fixture manifest failed: run-id")
  const fixturePrefix = `TEST-${runId}`
  const fixtureEmailPrefix = fixturePrefix.toLowerCase()
  const staffUserId = `${fixturePrefix}-staff`
  const portalUserId = `${fixturePrefix}-portal`
  const ids = {
    staffAccount: `${fixturePrefix}-staff-account`,
    staffRole: stableUuid(runId, "staff-role"),
    portalAccount: `${fixturePrefix}-portal-account`,
    portalRole: stableUuid(runId, "portal-role"),
    portalRepreneur: stableUuid(runId, "portal-repreneur"),
    firm: stableUuid(runId, "firm"),
    office: stableUuid(runId, "office"),
    contact: stableUuid(runId, "contact"),
    affiliation: stableUuid(runId, "affiliation"),
    geography: stableUuid(runId, "geography"),
    provisionalFirm: stableUuid(runId, "provisional-firm"),
    provisionalOffice: stableUuid(runId, "provisional-office"),
    provisionalCountContact: stableUuid(runId, "provisional-count-contact"),
    provisionalContextContact: stableUuid(runId, "provisional-context-contact"),
    provisionalAffiliation: stableUuid(runId, "provisional-affiliation"),
    provisionalContextUser: stableUuid(runId, "provisional-context-user"),
    provisionalContextRole: stableUuid(runId, "provisional-context-role"),
    provisionalContext: "acme_co_paris",
  }
  const referenceCode = `Q${createHash("sha256").update(runId).digest("hex").slice(0, 7).toUpperCase()}`
  return {
    runId,
    fixturePrefix,
    actors: {
      staff: { userId: staffUserId, email: `${fixtureEmailPrefix}-staff@test.invalid` },
      portal: { userId: portalUserId, email: `${fixtureEmailPrefix}-portal@test.invalid`, repreneurId: ids.portalRepreneur },
      applicant: { email: `delivered+${fixturePrefix.toLowerCase()}@resend.dev` },
      staffCreated: { email: `${fixtureEmailPrefix}-staff-created@test.invalid` },
    },
    ids,
    referenceCode,
    databaseRows: [
      row("user", staffUserId, fixturePrefix),
      row("account", ids.staffAccount, fixturePrefix),
      row("app_user_roles", ids.staffRole, fixturePrefix),
      row("user", portalUserId, fixturePrefix),
      row("account", ids.portalAccount, fixturePrefix),
      row("app_user_roles", ids.portalRole, fixturePrefix),
      row("repreneurs", ids.portalRepreneur, fixturePrefix),
      row("ma_firms", ids.firm, fixturePrefix),
      row("ma_offices", ids.office, fixturePrefix),
      row("ma_contacts", ids.contact, fixturePrefix),
      row("ma_contact_office_affiliations", ids.affiliation, fixturePrefix),
      row("geography_nodes", ids.geography, fixturePrefix),
      row("ma_firms", ids.provisionalFirm, fixturePrefix),
      row("ma_offices", ids.provisionalOffice, fixturePrefix),
      row("ma_contacts", ids.provisionalCountContact, fixturePrefix),
      row("ma_contacts", ids.provisionalContextContact, fixturePrefix),
      row("ma_contact_office_affiliations", ids.provisionalAffiliation, fixturePrefix),
      row("user", ids.provisionalContextUser, fixturePrefix),
      row("app_user_roles", ids.provisionalContextRole, fixturePrefix),
    ],
    singletonSnapshots: [
      { table: "ma_provisional_source_contexts", key: ids.provisionalContext },
      { table: "wave_journey_settings", key: "true" },
      { table: "email_daily_counts", key: "run-date" },
      { table: "rateLimit", key: "all-rows" },
    ],
    betterAuthIdentities: [staffUserId, portalUserId],
    storageObjects: [`${fixturePrefix}/fixtures/pilot.pdf`],
  }
}

// This is deliberately frozen to the fixture manifest written by bbfa442.
// Recovery may only clean a historical manifest when it is an exact match for
// this known format, never when it merely resembles the current shape.
export function buildLegacyFixtureManifest(runId) {
  if (runId !== LEGACY_RECOVERY_RUN_ID) throw new Error("Fixture manifest failed: legacy-run-id")
  const fixturePrefix = `TEST-${runId}`
  const fixtureEmailPrefix = fixturePrefix.toLowerCase()
  const staffUserId = `${fixturePrefix}-staff`
  const portalUserId = `${fixturePrefix}-portal`
  const ids = {
    staffAccount: `${fixturePrefix}-staff-account`,
    staffRole: stableUuid(runId, "staff-role"),
    portalAccount: `${fixturePrefix}-portal-account`,
    portalRole: stableUuid(runId, "portal-role"),
    portalRepreneur: stableUuid(runId, "portal-repreneur"),
    lockedRepreneur: stableUuid(runId, "locked-repreneur"),
    firm: stableUuid(runId, "firm"),
    office: stableUuid(runId, "office"),
    contact: stableUuid(runId, "contact"),
    affiliation: stableUuid(runId, "affiliation"),
    geography: stableUuid(runId, "geography"),
    provisionalFirm: stableUuid(runId, "provisional-firm"),
    provisionalOffice: stableUuid(runId, "provisional-office"),
    provisionalCountContact: stableUuid(runId, "provisional-count-contact"),
    provisionalContextContact: stableUuid(runId, "provisional-context-contact"),
    provisionalAffiliation: stableUuid(runId, "provisional-affiliation"),
    provisionalContextUser: stableUuid(runId, "provisional-context-user"),
    provisionalContextRole: stableUuid(runId, "provisional-context-role"),
    provisionalContext: "acme_co_paris",
  }
  const referenceCode = `Q${createHash("sha256").update(runId).digest("hex").slice(0, 7).toUpperCase()}`
  const manifest = {
    runId,
    fixturePrefix,
    actors: {
      staff: { userId: staffUserId, email: `${fixtureEmailPrefix}-staff@test.invalid` },
      portal: { userId: portalUserId, email: `${fixtureEmailPrefix}-portal@test.invalid`, repreneurId: ids.portalRepreneur },
      applicant: { email: `delivered+${fixturePrefix.toLowerCase()}@resend.dev` },
      staffCreated: { email: `${fixtureEmailPrefix}-staff-created@test.invalid` },
    },
    ids,
    referenceCode,
    databaseRows: [
      row("user", staffUserId, fixturePrefix), row("account", ids.staffAccount, fixturePrefix), row("app_user_roles", ids.staffRole, fixturePrefix),
      row("user", portalUserId, fixturePrefix), row("account", ids.portalAccount, fixturePrefix), row("app_user_roles", ids.portalRole, fixturePrefix),
      row("repreneurs", ids.portalRepreneur, fixturePrefix), row("repreneurs", ids.lockedRepreneur, fixturePrefix),
      row("ma_firms", ids.firm, fixturePrefix), row("ma_offices", ids.office, fixturePrefix), row("ma_contacts", ids.contact, fixturePrefix),
      row("ma_contact_office_affiliations", ids.affiliation, fixturePrefix), row("geography_nodes", ids.geography, fixturePrefix),
      row("ma_firms", ids.provisionalFirm, fixturePrefix), row("ma_offices", ids.provisionalOffice, fixturePrefix),
      row("ma_contacts", ids.provisionalCountContact, fixturePrefix), row("ma_contacts", ids.provisionalContextContact, fixturePrefix),
      row("ma_contact_office_affiliations", ids.provisionalAffiliation, fixturePrefix), row("user", ids.provisionalContextUser, fixturePrefix),
      row("app_user_roles", ids.provisionalContextRole, fixturePrefix),
    ],
    singletonSnapshots: [
      { table: "ma_provisional_source_contexts", key: ids.provisionalContext }, { table: "wave_journey_settings", key: "true" },
      { table: "email_daily_counts", key: "run-date" }, { table: "rateLimit", key: "all-rows" },
    ],
    betterAuthIdentities: [staffUserId, portalUserId],
    storageObjects: [`${fixturePrefix}/fixtures/pilot.pdf`],
  }
  if (createHash("sha256").update(canonicalJson(manifest)).digest("hex") !== LEGACY_RECOVERY_MANIFEST_SHA256) throw new Error("Fixture manifest failed: legacy-integrity")
  return manifest
}

function hasRecoveryFixtureShape(manifest, runId) {
  const prefix = `TEST-${runId}`
  return RUN_ID_PATTERN.test(runId)
    && manifest?.runId === runId && manifest.fixturePrefix === prefix
    && typeof manifest.referenceCode === "string" && /^Q[A-F0-9]{7}$/.test(manifest.referenceCode)
    && manifest.actors?.staff?.userId === `${prefix}-staff` && manifest.actors.staff.email === `${prefix.toLowerCase()}-staff@test.invalid`
    && manifest.actors?.portal?.userId === `${prefix}-portal` && manifest.actors.portal.email === `${prefix.toLowerCase()}-portal@test.invalid`
    && typeof manifest.actors.portal.repreneurId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/.test(manifest.actors.portal.repreneurId)
    && manifest.actors?.applicant?.email === `delivered+${prefix.toLowerCase()}@resend.dev`
    && manifest.actors?.staffCreated?.email === `${prefix.toLowerCase()}-staff-created@test.invalid`
    && Object.values(manifest.ids ?? {}).every((value) => typeof value === "string")
    && Array.isArray(manifest.databaseRows) && manifest.databaseRows.every((entry) => entry && entry.label === prefix && typeof entry.table === "string" && typeof entry.id === "string")
    && Array.isArray(manifest.singletonSnapshots) && Array.isArray(manifest.betterAuthIdentities) && Array.isArray(manifest.storageObjects)
}

export function assertRecoveryFixtureManifest(manifest, runId) {
  if (!hasRecoveryFixtureShape(manifest, runId)) throw new Error("Fixture manifest failed: recovery-shape")
  const serialized = canonicalJson(manifest)
  if (serialized === canonicalJson(buildFixtureManifest(runId))) return manifest
  if (runId === LEGACY_RECOVERY_RUN_ID && serialized === canonicalJson(buildLegacyFixtureManifest(runId))) return manifest
  throw new Error("Fixture manifest failed: recovery-manifest")
}

export function assertRecoveryArtifacts({ serverManifest, serverSingletonBefore, fixtureManifest, runtimeFixtures, singletonBefore }) {
  assertRecoveryFixtureManifest(fixtureManifest, fixtureManifest?.runId)
  if (
    !isDeepStrictEqual(serverManifest?.fixtureManifest, fixtureManifest)
    || !isDeepStrictEqual(serverManifest?.runtime ?? {}, runtimeFixtures)
    || !isDeepStrictEqual(serverSingletonBefore, singletonBefore)
  ) throw new Error("Fixture manifest failed: recovery-artifacts")
  return true
}

function validRef(value) {
  return typeof value === "string" && /^[a-z0-9]{20}$/.test(value) && value !== PRODUCTION_REF
}

function validOrigin(value, executionMode = "vercel") {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.origin !== value) return false
    if (executionMode === "github-runner") return url.origin === RUNNER_ORIGIN
    if (executionMode === "vercel") return url.origin === stableQaOrigin()
    return false
  } catch {
    return false
  }
}

function databaseRef(value) {
  try {
    const url = new URL(value)
    return url.hostname.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1]
      || decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]{20})$/)?.[1]
      || ""
  } catch {
    return ""
  }
}

export function assertSafeQaRuntime(env) {
  const executionMode = env?.QA_EXECUTION_MODE || "vercel"
  const projectRef = env?.QA_SUPABASE_PROJECT_REF
  if (!validRef(projectRef)) throw new Error("QA runtime isolation failed: project-ref")
  let apiRef = ""
  try {
    apiRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] || ""
  } catch {}
  if (apiRef !== projectRef) throw new Error("QA runtime isolation failed: api-ref")
  if (databaseRef(env.DATABASE_URL) !== projectRef) throw new Error("QA runtime isolation failed: database-ref")
  if (!validOrigin(env.QA_BROWSER_BASE_URL, executionMode) || env.QA_BROWSER_BASE_URL !== env.QA_VALIDATION_ORIGIN) {
    throw new Error("QA runtime isolation failed: origin")
  }
  return { projectRef, origin: env.QA_BROWSER_BASE_URL }
}

export function validateLiveEvidence({ expectedRef, expectedOrigin, expectedSha, evidence, allowStaleResidue = false, executionMode = "vercel" }) {
  if (!validRef(expectedRef)) fail("project-ref")
  if (!validOrigin(expectedOrigin, executionMode)) fail("deployment-origin")
  if (typeof expectedSha !== "string" || !/^[0-9a-f]{40}$/.test(expectedSha)) fail("deployment-sha")

  const supabase = evidence?.supabase
  if (supabase?.databaseRef !== expectedRef || supabase?.apiRef !== expectedRef || supabase?.storageRef !== expectedRef) fail("project-ref")
  if (!supabase?.databaseHealthy || !supabase?.restHealthy || !supabase?.authHealthy || !supabase?.storageHealthy) fail("provider-health")
  const storageBuckets = Array.isArray(supabase?.storageBuckets) ? [...supabase.storageBuckets].sort((a, b) => a.id.localeCompare(b.id)) : []
  if (
    storageBuckets.length !== 2 ||
    storageBuckets[0]?.id !== "cvs" || storageBuckets[0]?.public !== false ||
    storageBuckets[1]?.id !== "opportunity-documents" || storageBuckets[1]?.public !== false
  ) fail("storage-buckets")
  if (!allowStaleResidue && [supabase.applicationRows, supabase.betterAuthUsers, supabase.supabaseAuthUsers, supabase.storageObjects].some((count) => count !== 0)) fail("non-empty")

  let runtimeOrigin
  if (executionMode === "github-runner") {
    const runtime = evidence?.runtime
    if (runtime?.provider !== "github-runner") fail("runner-provider")
    if (runtime?.origin !== expectedOrigin || expectedOrigin !== RUNNER_ORIGIN) fail("deployment-origin")
    if (runtime?.candidateSha !== expectedSha) fail("deployment-sha")
    if (runtime?.loopbackOnly !== true) fail("runner-loopback")
    if (runtime?.productionEnvironmentAttached !== false) fail("production-environment")
    if (runtime?.authorizedStatus !== 200) fail("runner-status")
    runtimeOrigin = runtime.origin
  } else if (executionMode === "vercel") {
    const vercel = evidence?.vercel
    if (vercel?.projectName !== VALIDATION_PROJECT || vercel?.target !== null) fail("vercel-project")
    if (vercel?.origin !== expectedOrigin) fail("deployment-origin")
    if (vercel?.deploymentSha !== expectedSha) fail("deployment-sha")
    if (vercel?.productionEnvironmentAttached !== false) fail("production-environment")
    if (!Array.isArray(vercel?.aliases) || vercel.aliases.some((alias) => alias.endsWith(".re-new.team") || alias === "v0-re-new-2-0.vercel.app")) fail("alias")
    if (vercel?.protection?.unauthenticatedBlocked !== true || vercel?.protection?.authorizedStatus !== 200) fail("deployment-protection")
    runtimeOrigin = vercel.origin
  } else {
    fail("execution-mode")
  }

  const expectedContract = buildQaContract({
    projectRef: expectedRef,
    candidateSha: expectedSha,
    structureFingerprint: evidence?.candidateContract?.expectedStructureFingerprint,
  })
  assertDeployedQaContract(expectedContract, {
    ...evidence?.deployedContract,
    origin: runtimeOrigin,
  }, { expectedOrigin })

  return { projectRef: expectedRef, origin: expectedOrigin, deploymentSha: expectedSha }
}

export { QA_CONTRACT }
