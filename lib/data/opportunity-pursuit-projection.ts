import "server-only"

import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { projectOpportunityPursuitEvidence, type OpportunityPursuitEvidence, type OpportunityPursuitJourneyAction } from "@/lib/opportunity-pursuit-evidence"

export interface PursuitArtifactProjection { id: string; artifact_role: string; version_number: number; document_id: string; recorded_at: string }
export interface PursuitConfidentialGrantProjection { information_memo_document_id: string; source_disclosed_at: string; source_firm_id: string; source_firm_name: string; source_office_id: string; source_office_name: string; disclosed_contacts: Array<{ opportunity_contact_id: string; contact_id: string; name: string; email?: string | null }>; revoked_at?: string | null; revoked_reason?: string | null }
export interface PortalPursuitConfidentialGrant { informationMemoDocumentId: string; grantedAt: string }
export interface OpportunityPursuitProjectionView {
  matchId: string; opportunityId: string; repreneurId: string; enabled: boolean; status: string; opportunityStatus: string | null
  entries: OpportunityPursuitEvidence[]; currentTemplate: PursuitArtifactProjection | null
  currentRenewSignedCopy: PursuitArtifactProjection | null; currentRepreneurSignedCopy: PursuitArtifactProjection | null
  gate1Passed: boolean; gate2Passed: boolean; dispatched: boolean
  currentCycleId: string | null; steps: ReturnType<typeof projectOpportunityPursuitEvidence>["steps"]
  confidentialGrant: PursuitConfidentialGrantProjection | null; revoked: boolean; evidenceRequired: boolean
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
  const [{ data: rows }, { data: artifacts }, { data: templateArtifacts }, { data: grants }] = await Promise.all([
    supabase.from("opportunity_pursuit_evidence").select("*").eq("match_id", matchId).order("recorded_at", { ascending: true }),
    supabase.from("opportunity_nda_artifacts").select("id, artifact_role, version_number, document_id, recorded_at").eq("match_id", matchId).order("version_number", { ascending: false }),
    supabase.from("opportunity_nda_artifacts").select("id, artifact_role, version_number, document_id, recorded_at").eq("opportunity_id", match.opportunity_id).is("match_id", null).eq("artifact_role", "blank_template").order("version_number", { ascending: false }).limit(1),
    supabase.from("opportunity_pursuit_confidential_grants").select("information_memo_document_id, source_disclosed_at, source_firm_id, source_firm_name, source_office_id, source_office_name, disclosed_contacts, revoked_at, revoked_reason").eq("match_id", matchId).maybeSingle(),
  ])
  const entries = (rows ?? []) as OpportunityPursuitEvidence[]
  const byRole = (role: string) => ((artifacts ?? []) as PursuitArtifactProjection[]).find((artifact) => artifact.artifact_role === role) ?? null
  const renew = byRole("renew_signed_copy"), repreneur = byRole("repreneur_signed_copy")
  const projection = projectOpportunityPursuitEvidence({ enabled: Boolean(settings?.enabled), status: match.status, events: entries, currentRenewArtifactId: renew?.id, currentRepreneurArtifactId: repreneur?.id })
  const dispatched = projection.dispatched
  const opportunity = Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity
  const grant = (grants as PursuitConfidentialGrantProjection | null) ?? null
  const revoked = Boolean(grant?.revoked_at || entries.some((entry) => entry.event_type === "access_revoked"))
  const blockers: string[] = []
  if (!settings?.enabled) blockers.push("The WAVE journey kill switch is disabled.")
  if (match.status !== "active_pursuit") blockers.push("This is not an active pursuit.")
  if (!projection.gate1Passed) blockers.push("Gate 1 has not passed.")
  if (!projection.hasCurrentRenewCopy) blockers.push("The current Re-New signed copy is not validated.")
  if (!projection.hasCurrentRepreneurCopy) blockers.push("The current repreneur signed copy is not validated.")
  if (!projection.gate2Passed) blockers.push("Gate 2 has not passed.")
  const allowedActions: OpportunityPursuitJourneyAction[] = projection.nextAction ? [projection.nextAction] : []
  if (projection.gate2Passed && !grant?.revoked_at) allowedActions.push("revoke_access", "continue", "drop", "complete")
  if (match.status === "dropped") allowedActions.push("reopen")
  const template = ((templateArtifacts ?? []) as PursuitArtifactProjection[])[0] ?? null
  return { matchId: match.id, opportunityId: match.opportunity_id, repreneurId: match.repreneur_id, enabled: Boolean(settings?.enabled), status: match.status, opportunityStatus: (opportunity as { status?: string } | null)?.status ?? null, entries, currentTemplate: template, currentRenewSignedCopy: renew, currentRepreneurSignedCopy: repreneur, gate1Passed: projection.gate1Passed, gate2Passed: projection.gate2Passed, dispatched, currentCycleId: projection.currentCycleId, steps: projection.steps, confidentialGrant: grant, revoked, evidenceRequired: !projection.gate2Passed, nextAction: projection.nextAction, allowedActions: [...new Set(allowedActions)], blockers }
}

export async function getStaffPursuitProjection(matchId: string) {
  await requireStaffAccess()
  return loadProjection(matchId)
}

export async function getPortalPursuitProjection(matchId: string) {
  const access = await requirePortalAccess()
  const projection = await loadProjection(matchId)
  if (!projection || projection.repreneurId !== access.repreneurId) return null
  // The portal consumer must only render grants, not raw staff evidence.
  const opportunityIsActive = projection.opportunityStatus === "active"
  const canDisclose = projection.enabled && projection.status === "active_pursuit" && opportunityIsActive && projection.gate2Passed && projection.dispatched && !projection.revoked
  const confidentialGrant: PortalPursuitConfidentialGrant | null = canDisclose && projection.confidentialGrant
    ? { informationMemoDocumentId: projection.confidentialGrant.information_memo_document_id, grantedAt: projection.confidentialGrant.source_disclosed_at }
    : null
  return { matchId: projection.matchId, enabled: projection.enabled, gate1Passed: projection.gate1Passed, gate2Passed: projection.gate2Passed, dispatched: projection.dispatched, confidentialGrant, revoked: projection.revoked, evidenceRequired: projection.evidenceRequired }
}
