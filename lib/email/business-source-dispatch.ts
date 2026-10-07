import "server-only"
import { createElement } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import { withBusinessMailApproval, finishBusinessMail } from "./business-mail"
import { isBookingReminderDue } from "@/lib/booking-request-reminder"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"
import type { EmailTemplateKey } from "@/lib/types/email"

async function assertGenericSource(review: StaffEmailReview) {
  const db = createAdminClient(),
    context = review.source_context ?? {}
  const row = async (table: string, id: unknown, columns: string) => {
    const result = await db.from(table).select(columns).eq("id", id).maybeSingle()
    if (result.error || !result.data)
      throw new Error("The original business event is unavailable; nothing was sent.")
    return result.data as unknown as Record<string, unknown>
  }
  if (context.kind === "offer") {
    const current = await row("repreneur_offers", context.assignmentId, "repreneur_id,status")
    if (current.repreneur_id !== review.repreneur_id || current.status !== context.status)
      throw new Error("The offer event is no longer applicable.")
  } else if (context.kind === "milestone") {
    const current = await row(
      "offer_milestones",
      context.milestoneId,
      "is_completed,completed_at,repreneur_offer_id",
    )
    const offer = await row("repreneur_offers", current.repreneur_offer_id, "repreneur_id")
    if (
      !current.is_completed ||
      current.completed_at !== context.completedAt ||
      offer.repreneur_id !== review.repreneur_id
    )
      throw new Error("This milestone completion changed.")
  } else if (context.kind === "abandoned") {
    const current = await row(
      "intake_abandonment_tracking",
      context.trackingId,
      "repreneur_id,is_completed,reminder_count,last_activity_at",
    )
    if (
      current.repreneur_id !== review.repreneur_id ||
      current.is_completed ||
      Number(current.reminder_count ?? 0) + 1 !== context.reminderNumber ||
      Date.now() - Date.parse(String(current.last_activity_at)) < 24 * 60 * 60 * 1000
    )
      throw new Error("This abandonment reminder is no longer due.")
  } else if (context.kind === "interview") {
    const current = await row(
      "activities",
      context.activityId,
      "repreneur_id,activity_type,event_date",
    )
    if (
      current.repreneur_id !== review.repreneur_id ||
      current.activity_type !== "interview" ||
      current.event_date !== context.eventDate ||
      Date.parse(String(current.event_date)) + 24 * 60 * 60 * 1000 < Date.now()
    )
      throw new Error("This scheduled interview changed or elapsed.")
  } else if (context.kind === "booking") {
    const rep = await row("repreneurs", review.repreneur_id, "lifecycle_status,created_at")
    const [{ data: events, error }, interviews] = await Promise.all([
      db
        .from("repreneur_booking_request_events")
        .select("sent_at")
        .eq("repreneur_id", review.repreneur_id)
        .order("sent_at", { ascending: false })
        .limit(1),
      db
        .from("activities")
        .select("id")
        .eq("repreneur_id", review.repreneur_id)
        .eq("activity_type", "interview")
        .limit(1),
    ])
    const age = Date.now() - Date.parse(String(rep.created_at))
    if (
      error ||
      interviews.error ||
      rep.lifecycle_status !== "lead" ||
      age < 5 * 86400000 ||
      age >= 30 * 86400000 ||
      interviews.data?.length ||
      events?.[0]?.sent_at !== context.invitationAt ||
      !isBookingReminderDue(String(context.invitationAt), new Date())
    )
      throw new Error("This booking reminder is no longer eligible.")
  } else if (context.kind === "intake") {
    const rep = await row(
      "repreneurs",
      review.repreneur_id,
      "questionnaire_completed_at,tier1_score",
    )
    if (
      (context.variant === "completed_v2" || context.variant === "legacy_completed") &&
      !rep.questionnaire_completed_at
    )
      throw new Error("The original questionnaire completion is no longer recorded.")
    if (
      context.variant === "legacy_high_score" &&
      (!rep.questionnaire_completed_at || Number(rep.tier1_score) < Number(context.threshold))
    )
      throw new Error("The original high-score event is no longer eligible.")
  } else if (review.template_key === "rejection") {
    const rep = await row("repreneurs", review.repreneur_id, "lifecycle_status,rejected_at")
    if (rep.lifecycle_status !== "rejected" || rep.rejected_at !== context.rejectedAt)
      throw new Error("This rejection is no longer current.")
  } else if (context.kind && context.kind !== "manual" && context.kind !== "intake") {
    throw new Error("The original business source is not supported; no provider request was made.")
  }
}

/** Re-enter the released event service, never replay a business mutation. Its
 * current relationship/consent/document fence is still the provider authority. */
export async function dispatchBusinessReview(
  review: StaffEmailReview,
  token: string,
  actor: string,
) {
  const context = review.source_context ?? {}
  try {
    await withBusinessMailApproval({ review, token, actor }, async () => {
      switch (context.kind) {
        case "interest":
          await (
            await import("./interest-notification-delivery")
          ).deliverInterestNotification(String(context.eventId))
          break
        case "cycle":
          await (
            await import("./recommendation-cycle-delivery")
          ).deliverRecommendationCycleNotification(
            String(context.cycleId),
            context.deliveryKind as "client_reminder" | "staff_expiry",
          )
          break
        case "memo_feedback":
          await (
            await import("./memo-feedback-reminder-delivery")
          ).deliverMemoFeedbackReminder(String(context.grantEvidenceId))
          break
        case "digest":
          await (
            await import("./discovery-digest-delivery")
          ).deliverDiscoveryDigest(String(context.deliveryId))
          break
        case "recommendation":
          await (
            await import("./recommendation-assignment-delivery")
          ).deliverRecommendationAssignment(String(context.matchId), actor)
          break
        case "memo_available":
          await (
            await import("@/lib/trigger-opportunity-memo-notification")
          ).triggerOpportunityMemoNotification({
            opportunityId: String(context.opportunityId),
            matchId: String(context.matchId),
          })
          break
        case "direct_interest":
          await (
            await import("./locked-opportunity-interest")
          ).sendLockedOpportunityInterestEmail(
            context.input as Parameters<
              typeof import("./locked-opportunity-interest").sendLockedOpportunityInterestEmail
            >[0],
          )
          break
        default: {
          await assertGenericSource(review)
          const { sendEmail, sendEmailDirect } = await import("./send-email")
          const input = {
            to: review.recipient_email,
            subject: review.subject,
            react: createElement("p", null, review.body_text),
            templateKey: review.template_key as EmailTemplateKey,
            idempotencyKey: String(context.idempotencyKey),
            sourceContext: context,
            beforeProviderAttempt: async () => {
              await assertGenericSource(review)
              return true
            },
          }
          const result = review.repreneur_id
            ? await sendEmail({ ...input, repreneurId: review.repreneur_id })
            : await sendEmailDirect(input)
          if (result.success && context.kind === "abandoned") {
            // Consume a reminder only after conclusive provider acceptance.
            const { error } = await createAdminClient()
              .from("intake_abandonment_tracking")
              .update({
                reminder_sent_at: new Date().toISOString(),
                reminder_count: context.reminderNumber,
              })
              .eq("id", context.trackingId)
              .eq("reminder_count", Number(context.reminderNumber) - 1)
            if (error)
              throw new Error("Accepted reminder needs source clock reconciliation; do not resend.")
          }
        }
      }
    })
  } catch (cause) {
    const { data } = await createAdminClient()
      .from("staff_email_reviews")
      .select("state,provider_started_at")
      .eq("id", review.id)
      .maybeSingle()
    if (data?.state === "sending")
      await finishBusinessMail(
        { review, token, actor },
        {
          success: false,
          providerOutcome: data.provider_started_at ? "uncertain" : "blocked",
          error: cause instanceof Error ? cause.message : "Source verification unavailable.",
        },
      )
  }
  const { data, error } = await createAdminClient()
    .from("staff_email_reviews")
    .select("state,delivery_error,provider_started_at")
    .eq("id", review.id)
    .maybeSingle()
  if (error || !data)
    throw new Error("The provider result needs reconciliation; do not start another send.")
  if (data.state === "sending") {
    await finishBusinessMail(
      { review, token, actor },
      {
        success: false,
        providerOutcome: data.provider_started_at ? "uncertain" : "blocked",
        error: "The current source did not authorize delivery. Inspect its current evidence.",
      },
    )
    return {
      success: false,
      state: data.provider_started_at ? ("uncertain" as const) : ("failed" as const),
      reviewId: review.id,
      message: "The source did not confirm delivery; no new operation was created.",
    }
  }
  return {
    success: data.state === "sent",
    state: data.state as "sent" | "failed" | "uncertain",
    reviewId: review.id,
    message:
      data.state === "sent"
        ? "Provider accepted the reviewed message. Inbox delivery and reading remain separate evidence."
        : (data.delivery_error ?? "Delivery is unconfirmed; inspect this operation."),
  }
}
