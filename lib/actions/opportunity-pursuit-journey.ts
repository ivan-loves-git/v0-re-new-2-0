"use server"

import { randomUUID } from "crypto"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityPursuitJourneyAction } from "@/lib/opportunity-pursuit-evidence"

export type OpportunityPursuitJourneyResult = { success: true; message: string; eventId: string } | { success: false; message: string }

const evidenceAction: Partial<Record<OpportunityPursuitJourneyAction, string>> = {
  qualify: "intermediary_qualified", validate_template: "template_validated", pass_gate_1: "gate_1_passed",
  validate_renew_copy: "renew_signed_copy_validated", validate_repreneur_copy: "repreneur_signed_copy_validated",
  pass_gate_2: "gate_2_passed", record_dispatch: "manual_package_dispatched",
}

export async function runOpportunityPursuitJourneyAction(input: {
  matchId: string; action: OpportunityPursuitJourneyAction; artifactId?: string; documentId?: string; reason?: string; idempotencyKey?: string
}): Promise<OpportunityPursuitJourneyResult> {
  const staff = await requireStaffAccess()
  const actor = staff.user.email
  const supabase = createAdminClient()
  const key = input.idempotencyKey ?? randomUUID()
  try {
    if (input.action === "grant_confidential_access") {
      if (!input.documentId) return { success: false, message: "Select an Information Memorandum." }
      const { data, error } = await supabase.rpc("journey_grant_confidential_access", { p_match_id: input.matchId, p_information_memo_document_id: input.documentId, p_actor: actor, p_idempotency_key: key })
      if (error) throw error
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

export const qualifyOpportunityPursuit = (matchId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "qualify", idempotencyKey })
export async function startOpportunityPursuit(matchId: string, evidenceReference?: string, idempotencyKey = randomUUID()): Promise<OpportunityPursuitJourneyResult> {
  const staff = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("journey_start_pursuit", { p_match_id: matchId, p_actor: staff.user.email, p_idempotency_key: idempotencyKey, p_evidence_reference: evidenceReference ?? null })
  return error ? { success: false, message: error.message } : { success: true, message: "Active pursuit started.", eventId: data }
}
export const validateOpportunityPursuitTemplate = (matchId: string, artifactId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "validate_template", artifactId, idempotencyKey })
export const passOpportunityPursuitGate1 = (matchId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "pass_gate_1", idempotencyKey })
export const validateOpportunityPursuitSignedCopy = (matchId: string, role: "renew" | "repreneur", artifactId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: role === "renew" ? "validate_renew_copy" : "validate_repreneur_copy", artifactId, idempotencyKey })
export const passOpportunityPursuitGate2 = (matchId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "pass_gate_2", idempotencyKey })
export const recordOpportunityPursuitDispatch = (matchId: string, reference?: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "record_dispatch", reason: reference, idempotencyKey })
export const grantOpportunityPursuitConfidentialAccess = (matchId: string, documentId: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action: "grant_confidential_access", documentId, idempotencyKey })
export const transitionOpportunityPursuit = (matchId: string, action: Extract<OpportunityPursuitJourneyAction, "continue" | "drop" | "reopen" | "complete">, reason?: string, idempotencyKey?: string) =>
  runOpportunityPursuitJourneyAction({ matchId, action, reason, idempotencyKey })
