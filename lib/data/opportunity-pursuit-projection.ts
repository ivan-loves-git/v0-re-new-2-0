import "server-only"

import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { projectOpportunityPursuitEvidence, type OpportunityPursuitEvidence, type OpportunityPursuitJourneyAction } from "@/lib/opportunity-pursuit-evidence"

export interface PursuitArtifactProjection { id: string; artifact_role: string; version_number: number; document_id: string; recorded_at: string }
export interface PursuitConfidentialGrantProjection { information_memo_document_id: string; source_disclosed_at: string; source_firm_id: string; source_firm_name: string; source_office_id: string; source_office_name: string; disclosed_contacts: Array<{ opportunity_contact_id: string; contact_id: string; name: string; email?: string | null }>; nda_expires_at?: string | null; revoked_at?: string | null; revoked_reason?: string | null }
export interface PortalPursuitConfidentialGrant {
  informationMemoDocumentId: string
  grantedAt: string
  source: { firmName: string; officeName: string; contactNames: string[] }
}
export interface PortalAuthorizedNdaTemplate {
  documentId: string
  storageBucket: string
  storagePath: string
}
export interface OpportunityPursuitProjectionView {
  matchId: string; opportunityId: string; repreneurId: string; enabled: boolean; status: string; opportunityStatus: string | null
  entries: OpportunityPursuitEvidence[]; currentTemplate: PursuitArtifactProjection | null
  currentRenewSignedCopy: PursuitArtifactProjection | null; currentRepreneurSignedCopy: PursuitArtifactProjection | null
  gate1Passed: boolean; gate2Passed: boolean; dispatched: boolean
  currentCycleId: string | null; steps: ReturnType<typeof projectOpportunityPursuitEvidence>["steps"]
  confidentialGrant: PursuitConfidentialGrantProjection | null; revoked: boolean; hasLiveConfidentialGrant: boolean; evidenceRequired: boolean; ndaExpiresAt: string | null
  nextAction: OpportunityPursuitJourneyAction | null; allowedActions: OpportunityPursuitJourneyAction[]; blockers: string[]
}

async function loadProjection(matchId: string): Promise<OpportunityPursuitProjectionView | null> {
  const supabase = createAdminClient()
  const [{ data: match, error }, { data: settings }] = await Promise.all([
    supabase.from("opportunity_matches").select("id, opportunity_id, repreneur_id, status, opportunity:opportunities(status)").eq("id", matchId).maybeSingle(),
    supabase.from("wave_journey_settings").select("enabled").eq("singleton", true).maybeSingle(),
  ])
  if (error) throw new Error(error.message)
  if (!match) return null
  const [{ data: rows }, { data: artifacts }, { data: templateArtifacts }, { data: grants }, { data: currentGate1 }, { data: currentGate2 }, { data: currentDispatch }] = await Promise.all([
    supabase.from("opportunity_pursuit_evidence").select("*").eq("match_id", matchId).order("recorded_at", { ascending: true }),
    supabase.from("opportunity_nda_artifacts").select("id, artifact_role, version_number, document_id, recorded_at").eq("match_id", matchId).order("version_number", { ascending: false }),
    supabase.from("opportunity_nda_artifacts").select("id, artifact_role, version_number, document_id, recorded_at").eq("opportunity_id", match.opportunity_id).is("match_id", null).eq("artifact_role", "blank_template").order("version_number", { ascending: false }).limit(1),
    supabase.from("opportunity_pursuit_confidential_grants").select("information_memo_document_id, source_disclosed_at, source_firm_id, source_firm_name, source_office_id, source_office_name, disclosed_contacts, nda_expires_at, revoked_at, revoked_reason").eq("match_id", matchId).maybeSingle(),
    supabase.rpc("journey_current_gate_1_event", { p_match_id: matchId }),
    supabase.rpc("journey_current_gate_2_event", { p_match_id: matchId }),
    supabase.rpc("journey_current_dispatch_event", { p_match_id: matchId }),
  ])
  const entries = (rows ?? []) as OpportunityPursuitEvidence[]
  const byRole = (role: string) => ((artifacts ?? []) as PursuitArtifactProjection[]).find((artifact) => artifact.artifact_role === role) ?? null
  const renew = byRole("renew_signed_copy"), repreneur = byRole("repreneur_signed_copy")
  const projection = projectOpportunityPursuitEvidence({ enabled: Boolean(settings?.enabled), status: match.status, events: entries, currentRenewArtifactId: renew?.id, currentRepreneurArtifactId: repreneur?.id, currentGate1EventId: currentGate1 ?? null, currentGate2EventId: currentGate2 ?? null, currentDispatchEventId: currentDispatch ?? null })
  const dispatched = projection.dispatched
  const opportunity = Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity
  const grant = (grants as PursuitConfidentialGrantProjection | null) ?? null
  // A historical revocation belongs to a historical grant. The exact live
  // grant is authoritative, so a later valid grant is not poisoned by it.
  const expired = Boolean(grant?.nda_expires_at && new Date(grant.nda_expires_at).getTime() <= Date.now())
  const { data: canonicalGrantAccess, error: canonicalGrantAccessError } = grant
    ? await supabase.rpc("journey_repreneur_can_access_confidential", {
        p_match_id: matchId,
        p_repreneur_id: match.repreneur_id,
        p_document_id: grant.information_memo_document_id,
      })
    : { data: false, error: null }
  // A grant is live only when the database's canonical predicate accepts the
  // exact match, repreneur and IM. This also makes an invalidated artifact fail
  // closed without relying on a stale client-side flag.
  const hasLiveConfidentialGrant = !canonicalGrantAccessError && Boolean(canonicalGrantAccess)
  const revoked = Boolean(grant && !hasLiveConfidentialGrant) || Boolean(grant?.revoked_at || expired)
  const blockers: string[] = []
  if (!settings?.enabled) blockers.push("The WAVE journey kill switch is disabled.")
  if (match.status !== "active_pursuit") blockers.push("This is not an active pursuit.")
  if (!projection.gate1Passed) blockers.push("Gate 1 has not passed.")
  if (!projection.hasCurrentRenewCopy) blockers.push("The current Re-New signed copy is not validated.")
  if (!projection.hasCurrentRepreneurCopy) blockers.push("The current repreneur signed copy is not validated.")
  if (!projection.gate2Passed) blockers.push("Gate 2 has not passed.")
  const currentCycleEntries = projection.currentCycleId
    ? entries.slice(entries.findIndex((entry) => entry.id === projection.currentCycleId))
    : []
  const hasContinuedCurrentCycle = currentCycleEntries.some((entry) => entry.event_type === "continued")
  const nextAction = hasLiveConfidentialGrant && projection.nextAction === "grant_confidential_access"
    ? null
    : projection.nextAction
  const allowedActions: OpportunityPursuitJourneyAction[] = nextAction ? [nextAction] : []
  if (match.status === "active_pursuit") allowedActions.push("drop")
  if (hasLiveConfidentialGrant) allowedActions.push("revoke_access")
  if (hasLiveConfidentialGrant && !hasContinuedCurrentCycle) allowedActions.push("continue")
  if (hasLiveConfidentialGrant && hasContinuedCurrentCycle) allowedActions.push("complete")
  if (match.status === "dropped") allowedActions.push("reopen")
  const template = ((templateArtifacts ?? []) as PursuitArtifactProjection[])[0] ?? null
  if (expired) blockers.push("The NDA expiry has passed; confidential access is unavailable.")
  return { matchId: match.id, opportunityId: match.opportunity_id, repreneurId: match.repreneur_id, enabled: Boolean(settings?.enabled), status: match.status, opportunityStatus: (opportunity as { status?: string } | null)?.status ?? null, entries, currentTemplate: template, currentRenewSignedCopy: renew, currentRepreneurSignedCopy: repreneur, gate1Passed: projection.gate1Passed, gate2Passed: projection.gate2Passed, dispatched, currentCycleId: projection.currentCycleId, steps: projection.steps, confidentialGrant: grant, revoked, hasLiveConfidentialGrant, evidenceRequired: !projection.gate2Passed, nextAction, allowedActions: [...new Set(allowedActions)], blockers, ndaExpiresAt: grant?.nda_expires_at ?? null }
}

export async function getStaffPursuitProjection(matchId: string) {
  await requireStaffAccess()
  return loadProjection(matchId)
}

export interface PortalSafePursuitProjection {
  matchId: string
  enabled: boolean; gate1Passed: boolean; gate2Passed: boolean; dispatched: boolean
  confidentialGrant: PortalPursuitConfidentialGrant | null; revoked: boolean; evidenceRequired: boolean
}

async function getPortalSafePursuitProjectionForRepreneur(matchId: string, repreneurId: string): Promise<PortalSafePursuitProjection | null> {
  const projection = await loadProjection(matchId)
  if (!projection || projection.repreneurId !== repreneurId) return null
  // The portal consumer must only render grants, not raw staff evidence.
  const opportunityIsActive = projection.opportunityStatus === "active"
  const requestedDocumentId = projection.confidentialGrant?.information_memo_document_id
  const { data: canonicalAccess, error: canonicalAccessError } = requestedDocumentId
    ? await createAdminClient().rpc("journey_repreneur_can_access_confidential", { p_match_id: matchId, p_repreneur_id: repreneurId, p_document_id: requestedDocumentId })
    : { data: false, error: null }
  const canDisclose = !canonicalAccessError && Boolean(canonicalAccess) && projection.enabled && projection.status === "active_pursuit" && opportunityIsActive && projection.gate2Passed && projection.dispatched && !projection.revoked
  const confidentialGrant: PortalPursuitConfidentialGrant | null = canDisclose && projection.confidentialGrant
    ? {
        informationMemoDocumentId: projection.confidentialGrant.information_memo_document_id,
        grantedAt: projection.confidentialGrant.source_disclosed_at,
        source: {
          firmName: projection.confidentialGrant.source_firm_name,
          officeName: projection.confidentialGrant.source_office_name,
          contactNames: (projection.confidentialGrant.disclosed_contacts ?? [])
            .map((contact) => typeof contact?.name === "string" ? contact.name.trim() : "")
            .filter(Boolean),
        },
      }
    : null
  return { matchId: projection.matchId, enabled: projection.enabled, gate1Passed: projection.gate1Passed, gate2Passed: projection.gate2Passed, dispatched: projection.dispatched, confidentialGrant, revoked: projection.revoked, evidenceRequired: projection.evidenceRequired }
}

/** Staff preview deliberately receives the same portal-safe DTO as a real repreneur. */
export async function getStaffPortalPreviewPursuitProjection(matchId: string, repreneurId: string) {
  await requireStaffAccess()
  return getPortalSafePursuitProjectionForRepreneur(matchId, repreneurId)
}

export async function getPortalPursuitProjection(matchId: string) {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null
  return getPortalSafePursuitProjectionForRepreneur(matchId, access.repreneurId)
}

/** Return only the exact current template bound to Gate 1 for this active pursuit. */
export async function getPortalAuthorizedNdaTemplate(matchId: string): Promise<PortalAuthorizedNdaTemplate | null> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null

  const { data, error } = await createAdminClient().rpc("journey_repreneur_authorized_template", {
    p_match_id: matchId,
    p_repreneur_id: access.repreneurId,
  })
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
    documentId: row.document_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
  }
}
