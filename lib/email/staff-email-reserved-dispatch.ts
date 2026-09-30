import "server-only"

import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
import type { HandoffAttempt } from "@/lib/pursuit-handoff-delivery"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMaSourceWorkflowEmailPayload } from "@/lib/ma-workflows"
import { sendPursuitIntermediaryHandoff, sendPursuitNdaReadyNotice } from "@/lib/actions/opportunity-pursuit-handoffs"

export interface ReservedBulkSource {
  maReservationToken?: string
  handoffAttempt?: HandoffAttempt
}

async function readSourceDeliveryOutcome(review: StaffEmailReview): Promise<{
  state: "sent" | "failed" | null; providerMessageId: string | null; evidenceId: string | null
}> {
  const db = createAdminClient()
  if (review.source_kind === "ma") {
    const { data, error } = await db.from("ma_interactions")
      .select("id,delivery_status,provider_message_id")
      .eq("client_operation_key", review.source_operation_id)
      .eq("opportunity_id", review.opportunity_id)
      .eq("template_key", review.template_key)
      .eq("recipient_email_snapshot", review.recipient_email)
      .eq("title", review.subject)
      .eq("body_markdown", review.body_text).maybeSingle()
    if (error || !data) return { state: null, providerMessageId: null, evidenceId: null }
    return { state: data.delivery_status === "sent" && data.provider_message_id ? "sent"
      : data.delivery_status === "failed" ? "failed" : null,
      providerMessageId: data.provider_message_id ?? null, evidenceId: data.id ?? null }
  }
  const { data, error } = await db.from("opportunity_pursuit_handoff_deliveries")
    .select("delivery_status,provider_message_id,evidence_id")
    .eq("upstream_evidence_id", review.source_operation_id)
    .eq("match_id", review.match_id)
    .eq("handoff_type", review.source_kind).maybeSingle()
  if (error || !data) return { state: null, providerMessageId: null, evidenceId: null }
  return { state: data.delivery_status === "sent" && data.provider_message_id && data.evidence_id ? "sent"
    : data.delivery_status === "failed" ? "failed" : null,
    providerMessageId: data.provider_message_id ?? null, evidenceId: data.evidence_id ?? null }
}

/** The review was already reserved exactly once. Batch callers pass the
 * source reservation committed by the same SQL claim; individual recovery
 * keeps its established source reservation and replay semantics. */
export async function dispatchReservedStaffEmailReview(
  review: StaffEmailReview, actorId: string, reviewToken: string,
  sourceReservation?: ReservedBulkSource,
  approvedBy = actorId,
) {
  if (review.source_kind === "freshness") throw new Error("Freshness has a grouped provider receipt.")
  const db = createAdminClient()
  if (!reviewToken || !approvedBy) throw new Error("The exact review reservation is unavailable.")
  let result: { success: boolean; message: string; operationState?: "pending" | "failed" | "sent"; eventId?: string }
  try {
    if (review.source_kind === "ma") {
      if (sourceReservation && !sourceReservation.maReservationToken) throw new Error("The M&A source reservation is missing.")
      const payload = {
        templateKey: review.template_key, subject: review.subject, body: review.body_text,
        contactId: review.contact_link_id, clientOperationKey: review.source_operation_id,
      }
      const approval = { recipientEmail: review.recipient_email, templateVersion: review.template_version, actorId: approvedBy }
      result = sourceReservation
        ? await sendMaSourceWorkflowEmailPayload(review.opportunity_id, payload, undefined, approval,
            { maReservationToken: sourceReservation.maReservationToken! })
        : await sendMaSourceWorkflowEmailPayload(review.opportunity_id, payload, undefined, approval)
    } else if (review.source_kind === "e6") {
      if (sourceReservation && !sourceReservation.handoffAttempt) throw new Error("The pursuit reservation is missing.")
      result = await sendPursuitNdaReadyNotice(review.match_id!, review.id,
        sourceReservation ? { handoffAttempt: sourceReservation.handoffAttempt! } : undefined)
    } else {
      if (sourceReservation && (!sourceReservation.handoffAttempt || !sourceReservation.maReservationToken)) {
        throw new Error("The intermediary reservations are missing.")
      }
      result = await sendPursuitIntermediaryHandoff(review.match_id!, review.source_kind, review.id,
        sourceReservation ? { handoffAttempt: sourceReservation.handoffAttempt!, maReservationToken: sourceReservation.maReservationToken! } : undefined)
    }
  } catch (error) {
    result = { success: false, operationState: "pending", message: error instanceof Error ? error.message : "The delivery result is uncertain." }
  }
  const priorOutcomeUnknown = review.state === "uncertain" || review.state === "sending"
  let source: Awaited<ReturnType<typeof readSourceDeliveryOutcome>> | null = null
  if (result.success || priorOutcomeUnknown) {
    try { source = await readSourceDeliveryOutcome(review) }
    catch { /* Unreadable evidence is unknown, never a conclusive failure. */ }
  }
  let state: "sent" | "uncertain" | "failed" = source?.state === "sent" ? "sent"
    : priorOutcomeUnknown ? source?.state === "failed" ? "failed" : "uncertain"
    : result.success || result.operationState === "pending" || result.operationState === "sent" ? "uncertain" : "failed"
  if (result.success && source?.state !== "sent") state = "uncertain"
  const providerMessageId = state === "sent" ? source?.providerMessageId ?? null : null
  const evidenceId = state === "sent" ? source?.evidenceId ?? null : null
  const outcomeMessage = state === "uncertain" && result.success
    ? "The source reported provider acceptance, but its receipt could not be read. Do not create another send; reconcile this unchanged operation."
    : priorOutcomeUnknown && state === "uncertain"
      ? `${result.message} The earlier provider outcome remains uncertain; do not cancel or start another operation.`
      : priorOutcomeUnknown && state === "failed"
        ? "The source delivery record confirms a conclusive failure. The same reviewed message may be retried."
    : result.message
  const { error: finishError } = await db.rpc("staff_email_review_finish", {
    p_review_id: review.id, p_token: reviewToken, p_state: state,
    p_provider_message_id: providerMessageId, p_delivery_evidence_id: evidenceId,
    p_error: state === "sent" ? null : outcomeMessage, p_actor: actorId,
  })
  if (finishError) throw new Error("Delivery may have completed, but its review outcome was not finalized. Do not start another send; reconcile this record.")
  return { success: state === "sent", reviewId: review.id, state,
    blockedBeforeIo: state === "failed" && !priorOutcomeUnknown && !result.success && result.operationState === undefined,
    message: state === "sent"
    ? "Provider accepted the reviewed email. This does not confirm inbox delivery or reading."
    : outcomeMessage }
}
