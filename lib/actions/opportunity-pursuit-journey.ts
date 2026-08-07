"use server"

import { randomUUID } from "crypto"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityPursuitJourneyAction } from "@/lib/opportunity-pursuit-evidence"
import { triggerOpportunityMemoNotification } from "@/lib/trigger-opportunity-memo-notification"

export type OpportunityPursuitJourneyResult = { success: true; message: string; eventId: string } | { success: false; message: string }

const evidenceAction: Partial<Record<OpportunityPursuitJourneyAction, string>> = {
  request_qualification: "qualification_requested", qualify: "intermediary_qualified", validate_template: "template_validated", pass_gate_1: "gate_1_passed",
  validate_renew_copy: "renew_signed_copy_validated", validate_repreneur_copy: "repreneur_signed_copy_validated",
  pass_gate_2: "gate_2_passed", record_dispatch: "manual_package_dispatched",
}

export async function runOpportunityPursuitJourneyAction(input: {
  matchId: string; action: OpportunityPursuitJourneyAction; artifactId?: string; documentId?: string; reason?: string; ndaExpiresAt?: string; idempotencyKey?: string
}): Promise<OpportunityPursuitJourneyResult> {
  const staff = await requireStaffAccess()
  const actor = staff.user.email
  const supabase = createAdminClient()
  const key = input.idempotencyKey ?? randomUUID()
  try {
    if (input.action === "grant_confidential_access") {
      if (!input.documentId) return { success: false, message: "Select an Information Memorandum." }
      if (!input.ndaExpiresAt) return { success: false, message: "Set the NDA expiry before granting confidential access." }
      const { data, error } = await supabase.rpc("journey_grant_confidential_access", { p_match_id: input.matchId, p_information_memo_document_id: input.documentId, p_actor: actor, p_idempotency_key: key, p_nda_expires_at: input.ndaExpiresAt })
      if (error) throw error
      const { data: match, error: matchError } = await supabase
        .from("opportunity_matches")
        .select("opportunity_id")
        .eq("id", input.matchId)
        .maybeSingle()
      if (matchError || !match?.opportunity_id) {
        // The grant is already canonical and must not be rolled back because a
        // notification lookup failed. The once-only delivery remains retryable.
        console.error("Could not resolve the granted pursuit for its info memo notification")
      } else {
        await triggerOpportunityMemoNotification({
          opportunityId: match.opportunity_id,
          matchId: input.matchId,
        })
      }
      return { success: true, message: "Confidential access granted.", eventId: data }
    }
    if (input.action === "revoke_access") {
      const { data, error } = await supabase.rpc("journey_revoke_confidential_access", { p_match_id: input.matchId, p_actor: actor, p_reason: input.reason ?? "staff_revocation", p_idempotency_key: key })
      if (error) throw error
      return { success: true, message: "Confidential access revoked.", eventId: data }
    }
    if (["continue", "drop", "reopen", "complete"].includes(input.action)) {
      const { data, error } = await supabase.rpc("journey_transition_terminal", { p_match_id: input.matchId, p_transition: input.action, p_actor: actor, p_idempotency_key: key, p_closure_reason: input.reason ?? null })
      if (error) throw error
      return { success: true, message: `Pursuit ${input.action} recorded.`, eventId: data }
    }
    const eventType = evidenceAction[input.action]
    if (!eventType) return { success: false, message: "Unsupported journey action." }
    const { data, error } = await supabase.rpc("journey_record_evidence", { p_match_id: input.matchId, p_event_type: eventType, p_actor: actor, p_idempotency_key: key, p_artifact_id: input.artifactId ?? null, p_document_id: input.documentId ?? null, p_evidence_reference: input.reason ?? null })
    if (error) throw error
    return { success: true, message: "Pursuit evidence recorded.", eventId: data }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Could not record pursuit evidence." }
  }
}

export async function qualifyOpportunityPursuit(matchId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "qualify", idempotencyKey })
}
export async function requestOpportunityPursuitQualification(matchId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "request_qualification", idempotencyKey })
}
export async function startOpportunityPursuit(matchId: string, evidenceReference?: string, idempotencyKey = randomUUID()): Promise<OpportunityPursuitJourneyResult> {
  const staff = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("journey_start_pursuit", { p_match_id: matchId, p_actor: staff.user.email, p_idempotency_key: idempotencyKey, p_evidence_reference: evidenceReference ?? null })
  return error ? { success: false, message: error.message } : { success: true, message: "Active pursuit started.", eventId: data }
}
export async function validateOpportunityPursuitTemplate(matchId: string, artifactId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "validate_template", artifactId, idempotencyKey })
}
export async function passOpportunityPursuitGate1(matchId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "pass_gate_1", idempotencyKey })
}
export async function validateOpportunityPursuitSignedCopy(matchId: string, role: "renew" | "repreneur", artifactId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: role === "renew" ? "validate_renew_copy" : "validate_repreneur_copy", artifactId, idempotencyKey })
}
export async function passOpportunityPursuitGate2(matchId: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "pass_gate_2", idempotencyKey })
}
export async function recordOpportunityPursuitDispatch(matchId: string, reference?: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "record_dispatch", reason: reference, idempotencyKey })
}
export async function grantOpportunityPursuitConfidentialAccess(matchId: string, documentId: string, ndaExpiresAt: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action: "grant_confidential_access", documentId, ndaExpiresAt, idempotencyKey })
}
export async function transitionOpportunityPursuit(matchId: string, action: Extract<OpportunityPursuitJourneyAction, "continue" | "drop" | "reopen" | "complete">, reason?: string, idempotencyKey?: string) {
  return runOpportunityPursuitJourneyAction({ matchId, action, reason, idempotencyKey })
}
