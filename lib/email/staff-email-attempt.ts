import "server-only"

import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMaReviewContext, getMaReviewTemplateVersion, renderMaWorkflowContent, buildMaReviewedRequest } from "@/lib/ma-workflows"
import { preparePursuitHandoff } from "@/lib/pursuit-handoff-delivery"
import { fixedIntermediaryHandoffCopy, buildPursuitNdaReadyRequest } from "@/lib/pursuit-handoff-copy"
import { sameAttachmentSnapshot } from "@/lib/staff-email-review-guard"
import { fingerprintResendDeliveryRequest } from "@/lib/email/resend-delivery-outcome"
import { PURSUIT_REVIEW_COPY_VERSION } from "@/lib/email/review-copy-version"

/** Rebuild the current source-approved envelope. The persisted review words
 * and attachment metadata stay distinct from provider attachment bytes. */
export async function currentStaffEmailAttempt(review: StaffEmailReview) {
  if (review.namespace !== "REAL") throw new Error("DEMO drafts cannot deliver from the production review queue.")
  let request: { from: string; to: string[]; subject: string; html: string; text: string }
  let attachments = review.attachment_snapshot
  let fingerprint: string
  if (review.source_kind === "ma" || review.source_kind === "e4" || review.source_kind === "e7") {
    const version = await getMaReviewTemplateVersion(review.template_key, true)
    if (review.source_kind === "ma" && version !== review.template_version) {
      throw new Error("The catalogue template changed after preparation. This draft cannot be sent.")
    }
    const ma = await getMaReviewContext(review.opportunity_id, review.contact_link_id)
    if (ma.namespace !== "REAL" || ma.recipientEmail.trim().toLowerCase() !== review.recipient_email.trim().toLowerCase()) {
      throw new Error("The canonical opportunity recipient changed after review. No email was sent.")
    }
    if (review.source_kind === "ma" && review.template_key === "ma_nda_info_memo_request" && !ma.activeMatchId) {
      throw new Error("The required active pursuit is no longer current.")
    }
    if (review.source_kind !== "ma") {
      if (!review.match_id) throw new Error("Pursuit identity is missing.")
      const { handoff, context } = await preparePursuitHandoff(createAdminClient(), review.match_id, review.source_kind)
      const blank = context.upstream.metadata?.blank_nda_present_at_validation
      if (review.source_kind === "e4" && typeof blank !== "boolean") throw new Error("The E4 validation no longer has its NDA request.")
      const copy = fixedIntermediaryHandoffCopy(review.source_kind, Boolean(blank))
      const rendered = await renderMaWorkflowContent(review.opportunity_id, copy.subject, copy.body)
      if (handoff.upstreamId !== review.source_operation_id || rendered.subject !== review.subject || rendered.body !== review.body_text ||
          review.template_version !== PURSUIT_REVIEW_COPY_VERSION[review.source_kind] ||
          !sameAttachmentSnapshot(handoff.snapshot, review.attachment_snapshot)) {
        throw new Error("The handoff gate, fixed copy or signed PDFs changed after review.")
      }
      attachments = handoff.snapshot
      fingerprint = fingerprintResendDeliveryRequest(
        buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email, handoff.attachments),
        `${review.source_kind}:${review.source_operation_id}`,
      )
    } else {
      fingerprint = fingerprintResendDeliveryRequest(buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email))
    }
    request = buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email)
  } else if (review.source_kind === "e6") {
    if (!review.match_id) throw new Error("Pursuit identity is missing.")
    const { handoff, context } = await preparePursuitHandoff(createAdminClient(), review.match_id, "e6")
    const current = buildPursuitNdaReadyRequest(review.match_id, context)
    if (handoff.upstreamId !== review.source_operation_id || review.template_key !== "code:e6_nda_ready" || review.template_version !== PURSUIT_REVIEW_COPY_VERSION.e6 ||
        current.to[0] !== review.recipient_email || current.subject !== review.subject || current.text !== review.body_text || context.opportunity.is_demo) {
      throw new Error("The NDA-ready gate, recipient or governed copy changed after review.")
    }
    request = current
    fingerprint = fingerprintResendDeliveryRequest(current, `e6:${review.source_operation_id}`)
  } else {
    throw new Error("Grouped freshness uses its exact member reservation.")
  }
  return { payload: { ...request, attachments }, fingerprint }
}
