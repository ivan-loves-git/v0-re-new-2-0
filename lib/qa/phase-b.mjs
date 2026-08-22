import { createHash } from "node:crypto"
import { QA_CONTRACT, assertDeployedQaContract, buildQaContract, stableQaOrigin } from "./permanent-contract.mjs"

const PRODUCTION_REF = "iiuqcdnmxhtyispnykgf"
const VALIDATION_PROJECT = "renew-overnight-validation-20260820"
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/

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

function validRef(value) {
  return typeof value === "string" && /^[a-z0-9]{20}$/.test(value) && value !== PRODUCTION_REF
}

function validOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.origin === value && url.origin === stableQaOrigin()
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
  const projectRef = env?.QA_SUPABASE_PROJECT_REF
  if (!validRef(projectRef)) throw new Error("QA runtime isolation failed: project-ref")
  let apiRef = ""
  try {
    apiRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] || ""
  } catch {}
  if (apiRef !== projectRef) throw new Error("QA runtime isolation failed: api-ref")
  if (databaseRef(env.DATABASE_URL) !== projectRef) throw new Error("QA runtime isolation failed: database-ref")
  if (!validOrigin(env.QA_BROWSER_BASE_URL) || env.QA_BROWSER_BASE_URL !== env.QA_VALIDATION_ORIGIN) {
    throw new Error("QA runtime isolation failed: origin")
  }
  return { projectRef, origin: env.QA_BROWSER_BASE_URL }
}

export function validateLiveEvidence({ expectedRef, expectedOrigin, expectedSha, evidence, allowStaleResidue = false }) {
  if (!validRef(expectedRef)) fail("project-ref")
  if (!validOrigin(expectedOrigin)) fail("deployment-origin")
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

  const vercel = evidence?.vercel
  if (vercel?.projectName !== VALIDATION_PROJECT || vercel?.target !== "preview") fail("vercel-project")
  if (vercel?.origin !== expectedOrigin) fail("deployment-origin")
  if (vercel?.deploymentSha !== expectedSha) fail("deployment-sha")
  if (vercel?.productionEnvironmentAttached !== false) fail("production-environment")
  if (!Array.isArray(vercel?.aliases) || vercel.aliases.some((alias) => alias.endsWith(".re-new.team") || alias === "v0-re-new-2-0.vercel.app")) fail("alias")
  if (vercel?.protection?.unauthenticatedBlocked !== true || vercel?.protection?.authorizedStatus !== 200) fail("deployment-protection")

  const expectedContract = buildQaContract({
    projectRef: expectedRef,
    candidateSha: expectedSha,
    structureFingerprint: evidence?.candidateContract?.expectedStructureFingerprint,
  })
  assertDeployedQaContract(expectedContract, {
    ...evidence?.deployedContract,
    origin: vercel?.origin,
  })

  return { projectRef: expectedRef, origin: expectedOrigin, deploymentSha: expectedSha }
}

export { QA_CONTRACT }
