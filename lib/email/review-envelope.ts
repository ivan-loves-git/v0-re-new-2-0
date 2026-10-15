import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { configuredBusinessCc, businessTrackingCapability } from "./business-mail"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
export async function captureReviewEnvelope(review: StaffEmailReview, token: string) {
  const cc = configuredBusinessCc([review.recipient_email])
  const { isMaContactEmailAddressSuppressed } = await import("./ma-contact-email-authorization")
  if ((await Promise.all(cc.map(isMaContactEmailAddressSuppressed))).some(Boolean))
    throw new Error(
      "A required business copy recipient is currently suppressed; no provider request was made.",
    )
  const { error } = await createAdminClient().rpc("email_review_capture_envelope", {
    p_review_id: review.id,
    p_token: token,
    p_cc: cc,
    p_tracking: businessTrackingCapability().verified,
  })
  if (error)
    throw new Error("The exact envelope or current automatic policy changed before provider I/O.")
}
