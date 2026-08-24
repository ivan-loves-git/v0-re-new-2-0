import "server-only"

import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import {
  projectOpportunityPursuitEvidence,
  type OpportunityPursuitEvidence,
  type OpportunityPursuitJourneyAction,
} from "@/lib/opportunity-pursuit-evidence"
import { createAdminClient } from "@/lib/supabase/admin"
import { isRepreneurEligibleOpportunity } from "@/lib/repreneur-opportunity-eligibility"

export interface PursuitArtifactProjection {
  id: string
  artifact_role: string
  version_number: number
  document_id: string
  recorded_at: string
}

export interface PursuitConfidentialGrantProjection {
  information_memo_document_id: string
  source_disclosed_at: string
  source_firm_id: string
  source_firm_name: string
  source_office_id: string
  source_office_name: string
  disclosed_contacts: Array<{
    opportunity_contact_id: string
    contact_id: string
    name: string
    email?: string | null
  }>
  nda_expires_at?: string | null
  revoked_at?: string | null
  revoked_reason?: string | null
}

export interface StaffCurrentPursuit {
  matchId: string
  opportunityId: string
  repreneurId: string
  enabled: boolean
  status: string
  opportunityStatus: string | null
  entries: OpportunityPursuitEvidence[]
  currentTemplate: PursuitArtifactProjection | null
  currentRenewSignedCopy: PursuitArtifactProjection | null
  currentRepreneurSignedCopy: PursuitArtifactProjection | null
  gate1Passed: boolean
  gate2Passed: boolean
  dispatched: boolean
  currentCycleId: string | null
  steps: ReturnType<typeof projectOpportunityPursuitEvidence>["steps"]
  confidentialGrant: PursuitConfidentialGrantProjection | null
  revoked: boolean
  hasLiveConfidentialGrant: boolean
  evidenceRequired: boolean
  ndaExpiresAt: string | null
  nextAction: OpportunityPursuitJourneyAction | null
  allowedActions: OpportunityPursuitJourneyAction[]
  blockers: string[]
}

export interface PortalPursuitConfidentialGrant {
  informationMemoDocumentId: string
  grantedAt: string
  source: {
    firmName: string
    officeName: string
    contactNames: string[]
  }
}

export interface PortalCurrentPursuit {
  matchId: string
  enabled: boolean
  gate1Passed: boolean
  gate2Passed: boolean
  dispatched: boolean
  confidentialGrant: PortalPursuitConfidentialGrant | null
  revoked: boolean
  evidenceRequired: boolean
}

export type PortalPursuitViewer =
  | { kind: "portal" }
  | { kind: "staff-preview"; repreneurId: string }

export type PortalPursuitResourceRequest =
  | { kind: "nda-template" }
  | { kind: "information-memorandum"; documentId: string }

export type AuthorizedPortalPursuitResource =
  | {
      kind: "nda-template"
      documentId: string
      storageBucket: string
      storagePath: string
    }
  | { kind: "information-memorandum"; documentId: string }

async function resolveViewerRepreneurId(viewer: PortalPursuitViewer) {
  if (viewer.kind === "staff-preview") {
    await requireStaffAccess()
    return viewer.repreneurId || null
  }

  const access = await requirePortalAccess()
  return access.repreneurId
}

interface MatchRow {
  id: string
  opportunity_id: string
  repreneur_id: string
  status: string
  opportunity: { status?: string; is_demo?: boolean | null }
    | Array<{ status?: string; is_demo?: boolean | null }>
    | null
}

async function loadCurrentPursuit(
  matchId: string,
  expectedRepreneurId?: string,
): Promise<StaffCurrentPursuit | null> {
  const supabase = createAdminClient()
  const [matchResult, settingsResult] = await Promise.all([
    supabase
      .from("opportunity_matches")
      .select("id, opportunity_id, repreneur_id, status, opportunity:opportunities(status, is_demo)")
      .eq("id", matchId)
      .maybeSingle(),
    supabase
      .from("wave_journey_settings")
      .select("enabled")
      .eq("singleton", true)
      .maybeSingle(),
  ])
  if (matchResult.error) throw new Error(matchResult.error.message)

  const match = matchResult.data as MatchRow | null
  if (!match || (expectedRepreneurId && match.repreneur_id !== expectedRepreneurId)) {
    return null
  }
  const opportunity = Array.isArray(match.opportunity)
    ? match.opportunity[0]
    : match.opportunity
  if (expectedRepreneurId && !isRepreneurEligibleOpportunity(opportunity)) {
    return null
  }

  const [
    evidenceResult,
    artifactResult,
    templateResult,
    grantResult,
    gate1Result,
    gate2Result,
    dispatchResult,
  ] = await Promise.all([
    supabase
      .from("opportunity_pursuit_evidence")
      .select("*")
      .eq("match_id", matchId)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("opportunity_nda_artifacts")
      .select("id, artifact_role, version_number, document_id, recorded_at")
      .eq("match_id", matchId)
      .order("version_number", { ascending: false }),
    supabase
      .from("opportunity_nda_artifacts")
      .select("id, artifact_role, version_number, document_id, recorded_at")
      .eq("opportunity_id", match.opportunity_id)
      .is("match_id", null)
      .eq("artifact_role", "blank_template")
      .order("version_number", { ascending: false })
      .limit(1),
    supabase
      .from("opportunity_pursuit_confidential_grants")
      .select("information_memo_document_id, source_disclosed_at, source_firm_id, source_firm_name, source_office_id, source_office_name, disclosed_contacts, nda_expires_at, revoked_at, revoked_reason")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase.rpc("journey_current_gate_1_event", { p_match_id: matchId }),
    supabase.rpc("journey_current_gate_2_event", { p_match_id: matchId }),
    supabase.rpc("journey_current_dispatch_event", { p_match_id: matchId }),
  ])

  const entries = (evidenceResult.data ?? []) as OpportunityPursuitEvidence[]
  const artifacts = (artifactResult.data ?? []) as PursuitArtifactProjection[]
  const byRole = (role: string) => (
    artifacts.find((artifact) => artifact.artifact_role === role) ?? null
  )
  const renew = byRole("renew_signed_copy")
  const repreneur = byRole("repreneur_signed_copy")
  const projection = projectOpportunityPursuitEvidence({
    enabled: Boolean(settingsResult.data?.enabled),
    status: match.status,
    events: entries,
    currentRenewArtifactId: renew?.id,
    currentRepreneurArtifactId: repreneur?.id,
    currentGate1EventId: (gate1Result.data as string | null) ?? null,
    currentGate2EventId: (gate2Result.data as string | null) ?? null,
    currentDispatchEventId: (dispatchResult.data as string | null) ?? null,
  })
  const currentGrant = (
    grantResult.data as PursuitConfidentialGrantProjection | null
  ) ?? null
  const expired = Boolean(
    currentGrant?.nda_expires_at
    && new Date(currentGrant.nda_expires_at).getTime() <= Date.now(),
  )
  const canonicalGrantResult = currentGrant
    ? await supabase.rpc("journey_repreneur_can_access_confidential", {
        p_match_id: matchId,
        p_repreneur_id: match.repreneur_id,
        p_document_id: currentGrant.information_memo_document_id,
      })
    : { data: false, error: null }
  const hasLiveConfidentialGrant = (
    !canonicalGrantResult.error && Boolean(canonicalGrantResult.data)
  )
  const revoked = Boolean(currentGrant && !hasLiveConfidentialGrant)
    || Boolean(currentGrant?.revoked_at || expired)

  const blockers: string[] = []
  if (!settingsResult.data?.enabled) {
    blockers.push("The WAVE journey kill switch is disabled.")
  }
  if (match.status !== "active_pursuit") {
    blockers.push("This is not an active pursuit.")
  }
  if (!projection.gate1Passed) blockers.push("Gate 1 has not passed.")
  if (!projection.hasCurrentRenewCopy) {
    blockers.push("The current Re-New signed copy is not validated.")
  }
  if (!projection.hasCurrentRepreneurCopy) {
    blockers.push("The current repreneur signed copy is not validated.")
  }
  if (!projection.gate2Passed) blockers.push("Gate 2 has not passed.")
  if (expired) {
    blockers.push("The NDA expiry has passed; confidential access is unavailable.")
  }

  const cycleStartIndex = projection.currentCycleId
    ? entries.findIndex((entry) => entry.id === projection.currentCycleId)
    : -1
  const currentCycleEntries = cycleStartIndex >= 0
    ? entries.slice(cycleStartIndex)
    : []
  const hasContinuedCurrentCycle = currentCycleEntries.some(
    (entry) => entry.event_type === "continued",
  )
  const nextAction = (
    hasLiveConfidentialGrant
    && projection.nextAction === "grant_confidential_access"
  ) ? null : projection.nextAction
  const allowedActions: OpportunityPursuitJourneyAction[] = nextAction
    ? [nextAction]
    : []
  if (match.status === "active_pursuit") allowedActions.push("drop")
  if (hasLiveConfidentialGrant) allowedActions.push("revoke_access")
  if (hasLiveConfidentialGrant && !hasContinuedCurrentCycle) {
    allowedActions.push("continue")
  }
  if (hasLiveConfidentialGrant && hasContinuedCurrentCycle) {
    allowedActions.push("complete")
  }
  if (match.status === "dropped") allowedActions.push("reopen")

  return {
    matchId: match.id,
    opportunityId: match.opportunity_id,
    repreneurId: match.repreneur_id,
    enabled: Boolean(settingsResult.data?.enabled),
    status: match.status,
    opportunityStatus: opportunity?.status ?? null,
    entries,
    currentTemplate: (
      (templateResult.data ?? []) as PursuitArtifactProjection[]
    )[0] ?? null,
    currentRenewSignedCopy: renew,
    currentRepreneurSignedCopy: repreneur,
    gate1Passed: projection.gate1Passed,
    gate2Passed: projection.gate2Passed,
    dispatched: projection.dispatched,
    currentCycleId: projection.currentCycleId,
    steps: projection.steps,
    confidentialGrant: currentGrant,
    revoked,
    hasLiveConfidentialGrant,
    evidenceRequired: !projection.gate2Passed,
    ndaExpiresAt: currentGrant?.nda_expires_at ?? null,
    nextAction,
    allowedActions: [...new Set(allowedActions)],
    blockers,
  }
}

export async function readStaffCurrentPursuit(matchId: string) {
  await requireStaffAccess()
  return loadCurrentPursuit(matchId)
}

function toPortalCurrentPursuit(
  pursuit: StaffCurrentPursuit,
): PortalCurrentPursuit {
  const canDisclose = pursuit.hasLiveConfidentialGrant
    && pursuit.enabled
    && pursuit.status === "active_pursuit"
    && pursuit.opportunityStatus === "active"
    && pursuit.gate2Passed
    && pursuit.dispatched
    && !pursuit.revoked
  const confidentialGrant = canDisclose && pursuit.confidentialGrant
    ? {
        informationMemoDocumentId:
          pursuit.confidentialGrant.information_memo_document_id,
        grantedAt: pursuit.confidentialGrant.source_disclosed_at,
        source: {
          firmName: pursuit.confidentialGrant.source_firm_name,
          officeName: pursuit.confidentialGrant.source_office_name,
          contactNames: (pursuit.confidentialGrant.disclosed_contacts ?? [])
            .map((contact) => (
              typeof contact?.name === "string" ? contact.name.trim() : ""
            ))
            .filter(Boolean),
        },
      }
    : null

  return {
    matchId: pursuit.matchId,
    enabled: pursuit.enabled,
    gate1Passed: pursuit.gate1Passed,
    gate2Passed: pursuit.gate2Passed,
    dispatched: pursuit.dispatched,
    confidentialGrant,
    revoked: pursuit.revoked,
    evidenceRequired: pursuit.evidenceRequired,
  }
}

/** Staff preview and the real portal deliberately share this safe projection. */
export async function readPortalCurrentPursuit(input: {
  matchId: string
  viewer: PortalPursuitViewer
}): Promise<PortalCurrentPursuit | null> {
  const repreneurId = await resolveViewerRepreneurId(input.viewer)
  if (!repreneurId) return null
  const pursuit = await loadCurrentPursuit(input.matchId, repreneurId)
  return pursuit ? toPortalCurrentPursuit(pursuit) : null
}

/**
 * Resolve only a resource that the current portal viewer may read now.
 * Database predicates remain authoritative for the current pursuit cycle.
 */
export async function resolvePortalPursuitResource(input: {
  matchId: string
  viewer: PortalPursuitViewer
  resource: PortalPursuitResourceRequest
}): Promise<AuthorizedPortalPursuitResource | null> {
  const repreneurId = await resolveViewerRepreneurId(input.viewer)
  if (!repreneurId) return null

  const supabase = createAdminClient()
  if (input.resource.kind === "information-memorandum") {
    const { data, error } = await supabase.rpc(
      "journey_repreneur_can_access_confidential",
      {
        p_match_id: input.matchId,
        p_repreneur_id: repreneurId,
        p_document_id: input.resource.documentId,
      },
    )
    if (error || !data) return null
    return {
      kind: "information-memorandum",
      documentId: input.resource.documentId,
    }
  }

  const { data, error } = await supabase.rpc(
    "journey_repreneur_authorized_template",
    {
      p_match_id: input.matchId,
      p_repreneur_id: repreneurId,
    },
  )
  if (error) return null

  const row = (Array.isArray(data) ? data[0] : data) as {
    document_id?: unknown
    storage_bucket?: unknown
    storage_path?: unknown
  } | null
  if (
    !row
    || typeof row.document_id !== "string"
    || typeof row.storage_bucket !== "string"
    || typeof row.storage_path !== "string"
  ) return null

  return {
    kind: "nda-template",
    documentId: row.document_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
  }
}
