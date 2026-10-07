import "server-only"

import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildMaReviewedRequest, getMaReviewTemplateVersion } from "@/lib/ma-workflows"
import { resend } from "@/lib/email/resend-client"
import {
  classifyResendDeliveryOutcome,
  fingerprintResendDeliveryRequest,
} from "@/lib/email/resend-delivery-outcome"

/** One grouped provider attempt and one receipt cover the immutable members.
 * No single-opportunity M&A source send is fabricated for the siblings. */
export async function sendOpportunityFreshnessReview(
  review: StaffEmailReview,
  version: number,
  actorId: string,
  reservedToken?: string,
  manualApproval = false,
) {
  if (process.env.OPPORTUNITY_FRESHNESS_DISPATCH_ENABLED === "false") {
    throw new Error("Grouped freshness sending is temporarily disabled. Draft history is retained.")
  }
  if (review.version !== version || review.source_kind !== "freshness") {
    throw new Error("This grouped review changed. Refresh before sending.")
  }
  if (review.namespace !== "REAL") throw new Error("DEMO freshness cannot be sent.")
  await getMaReviewTemplateVersion("ma_opportunity_validity_check", true)

  if (manualApproval) {
    const { error } = await createAdminClient().rpc("email_review_mark_manual", {
      p_review_id: review.id,
      p_version: version,
      p_actor: actorId,
    })
    if (error)
      throw new Error("This grouped review changed before approval. Refresh its exact version.")
  }

  const request = buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email)
  const fingerprint = fingerprintResendDeliveryRequest(request, `freshness:${review.id}`)
  const db = createAdminClient()
  const { data: token, error: reserveError } = reservedToken
    ? { data: reservedToken, error: null }
    : await db.rpc("opportunity_freshness_reserve", {
        p_review_id: review.id,
        p_version: version,
        p_payload: request,
        p_fingerprint: fingerprint,
        p_actor: actorId,
      })
  if (reserveError || typeof token !== "string") {
    throw new Error(
      reserveError?.message?.includes("reconciliation_required")
        ? "The unchanged 23-hour retry window expired; reconcile this group, do not send a new operation."
        : "The whole group, recipient, version or current policy changed. Refresh before sending.",
    )
  }

  const priorUnknown = review.state === "sending" || review.state === "uncertain"
  let providerStarted = false
  let state: "sent" | "failed" | "uncertain" = "uncertain"
  let providerMessageId: string | null = null
  let message =
    "The provider result is uncertain. Reconcile or retry only this unchanged operation within 23 hours."
  try {
    // Last read occurs after the atomic queue reservation and immediately
    // before provider I/O. One changed member vetoes the entire email.
    const { error: memberError } = await db.rpc("opportunity_freshness_assert_current", {
      p_review_id: review.id,
    })
    if (memberError)
      throw new Error(
        "A grouped member or recipient changed before delivery. No new provider call was made.",
      )
    await getMaReviewTemplateVersion("ma_opportunity_validity_check", true)
    await (await import("@/lib/email/review-envelope")).captureReviewEnvelope(review, token)
    providerStarted = true
    const outcome = classifyResendDeliveryOutcome(
      await resend.emails.send(request, { idempotencyKey: review.id }),
    )
    if (outcome.outcome === "sent") {
      state = "sent"
      providerMessageId = outcome.providerMessageId
      message =
        "Provider accepted the grouped email. This does not confirm inbox delivery or reading."
    } else if (outcome.outcome === "failed" && !priorUnknown) {
      state = "failed"
      message = outcome.error
    } else {
      state = "uncertain"
      message = outcome.error
    }
  } catch (cause) {
    state = providerStarted || priorUnknown ? "uncertain" : "failed"
    message = cause instanceof Error ? cause.message : message
    if (state === "uncertain")
      message += " The prior/provider outcome remains uncertain; do not create another draft."
  }

  const { error: finishError } = await db.rpc("opportunity_freshness_finish", {
    p_review_id: review.id,
    p_token: token,
    p_state: state,
    p_provider_message_id: providerMessageId,
    p_error: state === "sent" ? null : message,
    p_actor: actorId,
  })
  if (finishError)
    throw new Error(
      "The provider may have accepted this grouped email, but its review receipt was not finalized. Reconcile this operation; do not create another send.",
    )
  return {
    success: state === "sent",
    reviewId: review.id,
    state,
    blockedBeforeIo: state === "failed" && !providerStarted && !priorUnknown,
    message,
  }
}
