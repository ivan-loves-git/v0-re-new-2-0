import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { render } from "@react-email/render"
import { createElement, type ReactElement } from "react"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
export async function businessCurrentCopy(review: StaffEmailReview) {
  const db = createAdminClient(),
    context = review.source_context ?? {}
  let subject: string, element: ReactElement
  if (context.kind === "interest") {
    const { data, error } = await db.rpc("w173_interest_delivery_payload", {
      p_event_id: context.eventId,
    })
    if (error || !data) throw new Error("Current interest copy unavailable.")
    const copy = (await import("./interest-notification-delivery")).renderInterestNotificationCopy(
      data,
    )
    subject = copy.subject
    element = (await import("./templates/interest-notification")).InterestNotificationEmail({
      ...copy,
      staff: review.template_key === "proposed_opportunity_response_staff",
    })
  } else if (context.kind === "memo_feedback") {
    const { data, error } = await db.rpc("w174_memo_feedback_delivery_payload", {
      p_grant_evidence_id: context.grantEvidenceId,
    })
    if (error || !data) throw new Error("Current reminder copy unavailable.")
    const copy = (await import("./memo-feedback-reminder-delivery")).renderMemoFeedbackCopy(data)
    subject = copy.subject
    element = (await import("./templates/memo-feedback-reminder")).MemoFeedbackReminderEmail(copy)
  } else if (context.kind === "cycle") {
    const { data, error } = await db.rpc("w175_cycle_delivery_payload", {
      p_cycle_id: context.cycleId,
      p_kind: context.deliveryKind,
    })
    if (error || !data) throw new Error("Current cycle copy unavailable.")
    const copy = (await import("./recommendation-cycle-delivery")).renderRecommendationCycleCopy(
      data,
    )
    subject = copy.subject
    element = (
      await import("./templates/recommendation-cycle-notification")
    ).RecommendationCycleNotificationEmail({
      ...copy,
      staff: context.deliveryKind === "staff_expiry",
    })
  } else {
    const { data: template, error } = await db
      .from("email_templates")
      .select("subject,body_markdown,body_editable")
      .eq("template_key", review.template_key)
      .maybeSingle()
    const { data: rep, error: repError } = await db
      .from("repreneurs")
      .select("id,first_name,last_name,email")
      .eq("id", review.repreneur_id)
      .maybeSingle()
    if (error || repError || !template?.body_editable || !template.body_markdown || !rep)
      throw new Error(
        "This governed copy has no current reusable body that can safely replace the prepared message.",
      )
    const repreneur = {
      id: rep.id,
      firstName: rep.first_name,
      lastName: rep.last_name,
      email: rep.email,
    }
    subject = template.subject
    if (review.template_key === "welcome")
      element = createElement((await import("./templates/welcome")).WelcomeEmail, {
        repreneur,
        bodyOverride: template.body_markdown,
        registrationComplete: context.variant !== "legacy_first_contact",
      })
    else if (review.template_key === "thank_you")
      element = createElement((await import("./templates/thank-you")).ThankYouEmail, {
        repreneur,
        bodyOverride: template.body_markdown,
      })
    else if (review.template_key === "booking_reminder")
      element = createElement((await import("./templates/booking-reminder")).BookingReminderEmail, {
        repreneur,
        bodyOverride: template.body_markdown,
      })
    else
      throw new Error(
        "Reusable replacement is unavailable for this code-governed message; edit its individual prose instead.",
      )
  }
  return { subject, body: await render(element, { plainText: true }), html: await render(element) }
}
