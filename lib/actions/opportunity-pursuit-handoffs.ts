"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendMaSourceWorkflowEmailPayload, renderMaWorkflowContent } from "@/lib/ma-workflows"
import { requireReservedHandoffReview, sameAttachmentSnapshot } from "@/lib/staff-email-review-guard"
import { fixedIntermediaryHandoffCopy, buildPursuitNdaReadyRequest } from "@/lib/pursuit-handoff-copy"
import { preparePursuitHandoff, beginPursuitHandoff, finalizePursuitHandoff, assertPursuitHandoffCurrent } from "@/lib/pursuit-handoff-delivery"
import { fingerprintResendDeliveryRequest, classifyResendDeliveryOutcome } from "@/lib/email/resend-delivery-outcome"
import { resend } from "@/lib/email/resend-client"
import { isMaContactEmailAddressSuppressed } from "@/lib/email/ma-contact-email-authorization"

function failure(error: unknown) {
  return { success: false as const, message: error instanceof Error ? error.message : "The current pursuit handoff could not be verified." }
}

export async function sendPursuitIntermediaryHandoff(matchId: string, type: "e4" | "e7", reviewId?: string) {
  await requireStaffAccess()
  if (type !== "e4" && type !== "e7") return { success: false as const, message: "Unsupported intermediary handoff." }
  const db = createAdminClient()
  try {
    const { handoff, context } = await preparePursuitHandoff(db, matchId, type)
    const blankPresent = context.upstream.metadata?.blank_nda_present_at_validation
    if (type === "e4" && typeof blankPresent !== "boolean") throw new Error("This historical validation has no frozen NDA request. Record a new mutual-interest validation before starting a new handoff.")
    const review = await requireReservedHandoffReview(reviewId, type, matchId, handoff.upstreamId)
    const copy = fixedIntermediaryHandoffCopy(type, Boolean(blankPresent))
    const rendered = await renderMaWorkflowContent(handoff.opportunityId, copy.subject, copy.body)
    if (review.subject !== rendered.subject || review.body_text !== rendered.body ||
        review.template_version !== `w112-${type}-v1` ||
        !sameAttachmentSnapshot(review.attachment_snapshot, handoff.snapshot)) {
      throw new Error("The governed handoff content or signed copies changed after review. No email was sent.")
    }
    const result = await sendMaSourceWorkflowEmailPayload(handoff.opportunityId, {
      templateKey: "ma_nda_info_memo_request", subject: review.subject, body: review.body_text,
      contactId: review.contact_link_id, clientOperationKey: handoff.upstreamId,
    }, handoff, { recipientEmail: review.recipient_email, templateVersion: review.template_version, actorId: review.approved_by })
    if (!result.success || !result.eventId) return { success: false as const, message: result.message, operationState: result.operationState }
    return { success: true as const, message: type === "e4" ? "Qualification request sent." : "Signed copies and memo request sent.", eventId: result.eventId, operationState: "sent" as const }
  } catch (error) { return failure(error) }
}

export async function sendPursuitNdaReadyNotice(matchId: string, reviewId?: string) {
  const staff = await requireStaffAccess()
  const db = createAdminClient()
  let attemptReserved = false
  try {
    const { handoff, context } = await preparePursuitHandoff(db, matchId, "e6")
    const request = buildPursuitNdaReadyRequest(matchId, context)
    const email = request.to[0]
    const review = await requireReservedHandoffReview(reviewId, "e6", matchId, handoff.upstreamId)
    if (review.template_key !== "code:e6_nda_ready" || review.template_version !== "w112-e6-v1" ||
        review.subject !== request.subject || review.body_text !== request.text || review.recipient_email !== email) {
      throw new Error("The NDA-ready recipient or governed copy changed after review. No email was sent.")
    }
    if (await isMaContactEmailAddressSuppressed(email)) throw new Error("The existing email suppression policy blocks this recipient.")
    const attempt = await beginPursuitHandoff(db, handoff, fingerprintResendDeliveryRequest(request, `e6:${handoff.upstreamId}`), staff.user.id)
    attemptReserved = attempt.delivery_status === "sending"
    if (attempt.delivery_status === "sent" && attempt.evidence_id) return { success: true as const, message: "NDA-ready notice was already sent.", eventId: attempt.evidence_id, operationState: "sent" as const }
    if (attempt.delivery_status === "in_flight") return { success: false as const, message: "The NDA-ready notice is still in flight. Retry the unchanged notice in two minutes.", operationState: "pending" as const }
    await assertPursuitHandoffCurrent(db, handoff)
    // Recheck the exact recipient and suppression immediately before provider I/O.
    const { data: current, error } = await db.from("repreneurs").select("email").eq("id", context.repreneur.id).maybeSingle()
    if (error || current?.email?.trim() !== email || await isMaContactEmailAddressSuppressed(email)) {
      await finalizePursuitHandoff(db, attempt, staff.user.id, "failed", null, "Canonical recipient changed or became suppressed before provider I/O.")
      return { success: false as const, message: "The NDA-ready recipient changed or cannot receive email. No new email was sent.", operationState: "failed" as const }
    }
    let outcome
    try { outcome = classifyResendDeliveryOutcome(await resend.emails.send(request, { idempotencyKey: attempt.operation_key })) }
    catch { return { success: false as const, message: "The NDA-ready result is uncertain. Retry this unchanged notice in two minutes; its send key will be reused.", operationState: "pending" as const } }
    if (outcome.outcome === "pending") return { success: false as const, message: "The NDA-ready result is uncertain. Retry this unchanged notice in two minutes; its send key will be reused.", operationState: "pending" as const }
    let eventId
    try { eventId = await finalizePursuitHandoff(db, attempt, staff.user.id, outcome.outcome, outcome.outcome === "sent" ? outcome.providerMessageId : null, outcome.outcome === "failed" ? outcome.error : null) }
    catch { return { success: false as const, message: "The provider result needs to be recorded. Retry this unchanged notice in two minutes to reconcile it safely.", operationState: "pending" as const } }
    if (outcome.outcome === "failed") return { success: false as const, message: "The provider rejected the NDA-ready notice.", operationState: "failed" as const }
    return { success: true as const, message: "NDA-ready notice sent.", eventId: eventId!, operationState: "sent" as const }
  } catch (error) { return { ...failure(error), operationState: attemptReserved ? "pending" as const : "failed" as const } }
}
