import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, wasEmailSent } from "@/lib/email"
import { getTemplateSubject, getTemplateBody } from "@/lib/email/template-content"
import { AbandonedReminderEmail } from "@/lib/email/templates/abandoned-reminder"
import { InterviewReminderEmail } from "@/lib/email/templates/interview-reminder"
import { BookingReminderEmail } from "@/lib/email/templates/booking-reminder"
import {
  cronReminderIdempotencyKey,
  deliverCronReminder,
} from "@/lib/email/cron-reminder-delivery"
import { env } from "@/lib/env"
import {
  startCriticalOperation,
  type CriticalOperationTrace,
} from "@/lib/observability/critical-operation"
import { cleanupExpiredPrivateUploads } from "@/lib/private-upload-server"

export const maxDuration = 60

// Vercel Cron: runs daily via vercel.json
// cron: 0 9 * * *

const ABANDONMENT_HOURS = 24 // Send reminder after 24 hours
const MAX_REMINDERS_PER_REPRENEUR = 2

// Bertrand is BCC'd on every interview reminder so he has a paper trail.
// Override with CC_ON_INTERVIEW_REMINDER env var if the address changes.
const INTERVIEW_REMINDER_BCC = env.CC_ON_INTERVIEW_REMINDER || "bertrand.galas@edu.escp.eu"

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron.
  // Vercel sends Authorization: Bearer $CRON_SECRET when CRON_SECRET is set.
  const authHeader = request.headers.get("authorization")
  const secret = env.CRON_SECRET
  const bearerOk = !!secret && authHeader === `Bearer ${secret}`
  if (!bearerOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const trace = startCriticalOperation("cron.abandoned_forms")
  let activeSubjobTrace: CriticalOperationTrace | null = null

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const cutoffTime = new Date(now.getTime() - ABANDONMENT_HOURS * 60 * 60 * 1000)

    // Find abandoned forms:
    // - Not completed
    // - Last activity more than 24 hours ago
    // - Have marketing consent (GDPR compliant)
    // - Haven't received max reminders
    const abandonedTrace = startCriticalOperation("cron.abandoned_reminders")
    activeSubjobTrace = abandonedTrace
    const { data: abandonedForms, error } = await supabase
      .from("intake_abandonment_tracking")
      .select(`
        id,
        repreneur_id,
        last_step_completed,
        last_activity_at,
        reminder_count,
        repreneurs!inner(
          id,
          first_name,
          last_name,
          email,
          marketing_consent
        )
      `)
      .eq("is_completed", false)
      .lt("last_activity_at", cutoffTime.toISOString())
      .lt("reminder_count", MAX_REMINDERS_PER_REPRENEUR)

    if (error) {
      abandonedTrace.failure("persistence_failed")
      trace.failure("persistence_failed")
      activeSubjobTrace = null
      return NextResponse.json({ error: "Cron job failed" }, { status: 500 })
    }

    let sentCount = 0
    const errors: string[] = []
    let abandonedDeliveryFailed = false

    // Empty abandoned-forms list is fine — still fall through to the
    // interview-reminder sub-job below (they share the same daily cron slot).
    for (const form of abandonedForms || []) {
      const repreneurRow = Array.isArray(form.repreneurs) ? form.repreneurs[0] : form.repreneurs
      const repreneur = repreneurRow as {
        id: string
        first_name: string
        last_name: string
        email: string
        marketing_consent: boolean
      }

      // Skip if no marketing consent
      if (!repreneur.marketing_consent) {
        continue
      }

      // Check if we already sent this email type to this repreneur recently
      const alreadySent = await wasEmailSent(
        repreneur.id,
        "abandoned_reminder",
        24 * 60 // 24 hour window
      )

      if (alreadySent) {
        continue
      }

      try {
        // Calculate days since abandonment
        const lastActivity = new Date(form.last_activity_at || now)
        const daysAgo = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

        const abandonedSubject = await getTemplateSubject("abandoned_reminder", "Reprenez votre inscription Re-New")
        const delivery = await deliverCronReminder({
          idempotencyKey: cronReminderIdempotencyKey.abandoned(
            form.id,
            (form.reminder_count || 0) + 1,
          ),
          send: (idempotencyKey) => sendEmail({
            to: repreneur.email,
            subject: abandonedSubject,
            repreneurId: repreneur.id,
            templateKey: "abandoned_reminder",
            requiresConsent: true,
            idempotencyKey,
            react: AbandonedReminderEmail({
              repreneur: {
                id: repreneur.id,
                firstName: repreneur.first_name,
                lastName: repreneur.last_name,
                email: repreneur.email,
              },
              metadata: {
                lastStep: form.last_step_completed || 1,
                totalSteps: 6,
                daysAgo: daysAgo,
              },
            }),
          }),
        })
        // Only a confirmed provider acceptance consumes one of the two reminder
        // attempts. A rejected or inconclusive response remains eligible for a
        // later cron retry; claiming it here would silently exhaust the cap.
        if (delivery.status === "failed") {
          abandonedDeliveryFailed = true
          continue
        }
        if (delivery.status === "busy") continue

        // Update the cap only after the provider has conclusively accepted the
        // reminder, so a daily run can never count one delivery twice.
        const { error: reminderUpdateError } = await supabase
          .from("intake_abandonment_tracking")
          .update({
            reminder_count: (form.reminder_count || 0) + 1,
            last_reminder_at: now.toISOString(),
          })
          .eq("id", form.id)
          .eq("reminder_count", form.reminder_count || 0)

        if (reminderUpdateError) {
          errors.push("abandoned_reminder_persistence_failed")
          continue
        }

        if (delivery.status === "sent") sentCount++
      } catch {
        errors.push("abandoned_reminder_failed")
      }
    }
    if (errors.length > 0 || abandonedDeliveryFailed) abandonedTrace.failure("provider_unavailable")
    else abandonedTrace.success()
    activeSubjobTrace = null

    // === Second job on the same cron: pre-interview reminders ===
    // Hobby plan caps us at one cron/day, so we piggyback here. `activities.event_date`
    // is a DATE column (no time), so precision is whole-day: at 9am today we email
    // everyone whose interview is scheduled for tomorrow.
    let interviewSent = 0
    const interviewErrors: string[] = []
    let interviewDeliveryFailed = false
    const interviewTrace = startCriticalOperation("cron.interview_reminders")
    activeSubjobTrace = interviewTrace
    try {
      const tomorrow = new Date(now)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      const tomorrowDate = tomorrow.toISOString().slice(0, 10) // YYYY-MM-DD

      const { data: upcomingInterviews } = await supabase
        .from("activities")
        .select(`
          id,
          repreneur_id,
          event_date,
          notes,
          repreneur:repreneurs(id, first_name, last_name, email)
        `)
        .eq("activity_type", "interview")
        .eq("event_date", tomorrowDate)

      for (const activity of upcomingInterviews || []) {
        // Supabase returns the joined row as an object (single relation); `as unknown` to
        // bypass the generic array inference used by the typed client.
        const rep = activity.repreneur as unknown as {
          id: string
          first_name: string
          last_name: string
          email: string
        } | null
        if (!rep?.email) continue

        // Dedupe: don't resend if the same repreneur already got a reminder in
        // the last 20h (handles cron mis-fires and restarts).
        const alreadySent = await wasEmailSent(rep.id, "interview_reminder", 20 * 60)
        if (alreadySent) continue

        try {
          const interviewSubject = await getTemplateSubject("interview_reminder", "Rappel : votre entretien Re-New demain")
          const delivery = await deliverCronReminder({
            idempotencyKey: cronReminderIdempotencyKey.interview(
              String(activity.id),
              String(activity.event_date),
            ),
            send: (idempotencyKey) => sendEmail({
              to: rep.email,
              subject: interviewSubject,
              repreneurId: rep.id,
              templateKey: "interview_reminder",
              bcc: INTERVIEW_REMINDER_BCC ? [INTERVIEW_REMINDER_BCC] : undefined,
              idempotencyKey,
              react: InterviewReminderEmail({
                repreneur: {
                  id: rep.id,
                  firstName: rep.first_name,
                  lastName: rep.last_name,
                  email: rep.email,
                },
                metadata: {
                  interviewAt: activity.event_date as string,
                  notes: (activity.notes as string | null) || undefined,
                },
              }),
            }),
          })
          if (delivery.status === "sent") interviewSent++
          else if (delivery.status === "failed") interviewDeliveryFailed = true
        } catch {
          interviewErrors.push("interview_reminder_failed")
        }
      }
    } catch {
      interviewErrors.push("interview_reminder_subjob_failed")
    }
    if (interviewErrors.length > 0) interviewTrace.failure("internal_error")
    else if (interviewDeliveryFailed) interviewTrace.failure("provider_unavailable")
    else interviewTrace.success()
    activeSubjobTrace = null

    // === Third job on the same cron: Day-5 booking reminders ===
    // Fires once for repreneurs who applied >5 days ago AND have no interview
    // activity logged yet AND haven't already received a booking_reminder.
    // Cap at 30 days so stale leads are handled by the reactivation flow below
    // rather than receiving a surprise old booking nudge.
    let bookingSent = 0
    const bookingErrors: string[] = []
    let bookingDeliveryFailed = false
    const bookingTrace = startCriticalOperation("cron.booking_reminders")
    activeSubjobTrace = bookingTrace
    try {
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const { data: candidates } = await supabase
        .from("repreneurs")
        .select("id, first_name, last_name, email, lifecycle_status, created_at, marketing_consent")
        .eq("lifecycle_status", "lead")
        .gt("created_at", thirtyDaysAgo.toISOString())
        .lte("created_at", fiveDaysAgo.toISOString())

      // Pre-load any interview activities for these repreneurs in one query.
      const candidateIds = (candidates || []).map((c) => c.id)
      let withInterview = new Set<string>()
      if (candidateIds.length > 0) {
        const { data: existingInterviews } = await supabase
          .from("activities")
          .select("repreneur_id")
          .eq("activity_type", "interview")
          .in("repreneur_id", candidateIds)
        withInterview = new Set((existingInterviews || []).map((a) => a.repreneur_id))
      }

      for (const c of candidates || []) {
        if (withInterview.has(c.id)) continue
        if (!c.email) continue

        // Dedupe: never send a booking_reminder twice (regardless of how long ago).
        const alreadySent = await wasEmailSent(c.id, "booking_reminder")
        if (alreadySent) continue

        try {
          const bookingSubject = await getTemplateSubject("booking_reminder", "Planifions un premier échange Re-New")
          const bookingBody = await getTemplateBody("booking_reminder")
          const delivery = await deliverCronReminder({
            idempotencyKey: cronReminderIdempotencyKey.booking(String(c.id)),
            send: (idempotencyKey) => sendEmail({
              to: c.email,
              subject: bookingSubject,
              repreneurId: c.id,
              templateKey: "booking_reminder",
              bcc: INTERVIEW_REMINDER_BCC ? [INTERVIEW_REMINDER_BCC] : undefined,
              idempotencyKey,
              react: BookingReminderEmail({
                repreneur: {
                  id: c.id,
                  firstName: c.first_name,
                  lastName: c.last_name,
                  email: c.email,
                },
                bodyOverride: bookingBody,
              }),
            }),
          })
          if (delivery.status === "sent") bookingSent++
          else if (delivery.status === "failed") bookingDeliveryFailed = true
        } catch {
          bookingErrors.push("booking_reminder_failed")
        }
      }
    } catch {
      bookingErrors.push("booking_reminder_subjob_failed")
    }
    if (bookingErrors.length > 0) bookingTrace.failure("internal_error")
    else if (bookingDeliveryFailed) bookingTrace.failure("provider_unavailable")
    else bookingTrace.success()
    activeSubjobTrace = null

    // === Fourth job: auto-shift stale Leads to "to_reactivate" ===
    // Leads with no interview activity at all and created >30 days ago move
    // to a separate group so they stop polluting Bertrand's top funnel view.
    let staleShifted = 0
    const staleErrors: string[] = []
    const staleTrace = startCriticalOperation("cron.stale_leads")
    activeSubjobTrace = staleTrace
    try {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: staleCandidates, error: staleCandidateError } = await supabase
        .from("repreneurs")
        .select("id")
        .eq("lifecycle_status", "lead")
        .eq("is_demo", false)
        .lte("created_at", thirtyDaysAgo)

      if (staleCandidateError) {
        staleErrors.push("stale_lead_persistence_failed")
      }
      const candidateIds = (staleCandidates || []).map((r) => r.id)
      if (candidateIds.length > 0 && staleErrors.length === 0) {
        // A lead can be old and still have live work: a current offer, an active
        // WAVE pursuit, or an active external dossier. None of these may be
        // auto-hidden just because no interview has yet been logged.
        const [interviewsResult, offersResult, pursuitsResult, externalResult] = await Promise.all([
          supabase
            .from("activities")
            .select("repreneur_id")
            .eq("activity_type", "interview")
            .in("repreneur_id", candidateIds),
          supabase
            .from("repreneur_offers")
            .select("repreneur_id")
            .in("repreneur_id", candidateIds)
            .in("status", ["offered", "accepted", "active"]),
          supabase
            .from("opportunity_matches")
            .select("repreneur_id, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(is_demo)")
            .in("repreneur_id", candidateIds)
            .eq("status", "active_pursuit")
            .eq("opportunity.is_demo", false)
            .eq("repreneur.is_demo", false),
          supabase
            .from("external_pursuits")
            .select("owner_repreneur_id")
            .in("owner_repreneur_id", candidateIds)
            .eq("deletion_status", "active"),
        ])
        if (
          interviewsResult.error ||
          offersResult.error ||
          pursuitsResult.error ||
          externalResult.error
        ) {
          staleErrors.push("stale_lead_persistence_failed")
        } else {
          const skip = new Set([
            ...(interviewsResult.data || []).map((row) => row.repreneur_id),
            ...(offersResult.data || []).map((row) => row.repreneur_id),
            ...(pursuitsResult.data || []).map((row) => row.repreneur_id),
            ...(externalResult.data || []).map((row) => row.owner_repreneur_id),
          ])
          const toShift = candidateIds.filter((id) => !skip.has(id))
          if (toShift.length > 0) {
            const { error: shiftError } = await supabase
              .from("repreneurs")
              .update({ lifecycle_status: "to_reactivate" })
              .in("id", toShift)
            if (shiftError) {
              staleErrors.push("stale_lead_persistence_failed")
            } else {
              staleShifted = toShift.length
            }
          }
        }
      }
    } catch {
      staleErrors.push("stale_lead_subjob_failed")
    }
    if (staleErrors.length > 0) staleTrace.failure("persistence_failed")
    else staleTrace.success()
    activeSubjobTrace = null

    // Reuse the one available production cron slot. A bounded daily batch is
    // enough at the current upload volume; the durable queue carries any
    // remainder to the next run, and the dedicated route remains available
    // for an authorized manual catch-up.
    const privateUploadCleanupErrors: string[] = []
    const privateUploadCleanupTrace = startCriticalOperation("cron.private_upload_cleanup")
    activeSubjobTrace = privateUploadCleanupTrace
    try {
      await cleanupExpiredPrivateUploads({ batchSize: 25 })
    } catch {
      privateUploadCleanupErrors.push("private_upload_cleanup_failed")
    }
    if (privateUploadCleanupErrors.length > 0) privateUploadCleanupTrace.failure("persistence_failed")
    else privateUploadCleanupTrace.success()
    activeSubjobTrace = null

    const allErrors = [
      ...errors,
      ...interviewErrors,
      ...bookingErrors,
      ...staleErrors,
      ...privateUploadCleanupErrors,
    ]
    if (
      allErrors.length > 0 ||
      abandonedDeliveryFailed ||
      interviewDeliveryFailed ||
      bookingDeliveryFailed
    ) trace.failure("internal_error")
    else trace.success()
    return NextResponse.json({
      message: `abandoned: ${sentCount}; interview reminders: ${interviewSent}; booking reminders: ${bookingSent}; stale leads shifted: ${staleShifted}`,
      sent: sentCount,
      interviewSent,
      bookingSent,
      staleShifted,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch {
    activeSubjobTrace?.failure("internal_error")
    trace.failure("internal_error")
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
