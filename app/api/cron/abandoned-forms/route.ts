import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, wasEmailSent } from "@/lib/email"
import { AbandonedReminderEmail } from "@/lib/email/templates/abandoned-reminder"
import { InterviewReminderEmail } from "@/lib/email/templates/interview-reminder"
import { BookingReminderEmail } from "@/lib/email/templates/booking-reminder"

// Vercel Cron: runs every hour
// cron: 0 * * * *

const ABANDONMENT_HOURS = 24 // Send reminder after 24 hours
const MAX_REMINDERS_PER_REPRENEUR = 2

// Bertrand is BCC'd on every interview reminder so he has a paper trail.
// Override with CC_ON_INTERVIEW_REMINDER env var if the address changes.
const INTERVIEW_REMINDER_BCC = process.env.CC_ON_INTERVIEW_REMINDER || "bertrand.galas@edu.escp.eu"

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()
    const cutoffTime = new Date(now.getTime() - ABANDONMENT_HOURS * 60 * 60 * 1000)

    // Find abandoned forms:
    // - Not completed
    // - Last activity more than 24 hours ago
    // - Have marketing consent (GDPR compliant)
    // - Haven't received max reminders
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
      console.error("Error fetching abandoned forms:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sentCount = 0
    const errors: string[] = []

    // Empty abandoned-forms list is fine — still fall through to the
    // interview-reminder sub-job below (they share the same daily cron slot).
    for (const form of abandonedForms || []) {
      const repreneur = form.repreneurs as {
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

        await sendEmail({
          to: repreneur.email,
          subject: "Reprenez votre inscription Re-New",
          repreneurId: repreneur.id,
          templateKey: "abandoned_reminder",
          requiresConsent: true,
          react: AbandonedReminderEmail({
            repreneur: {
              id: repreneur.id,
              firstName: repreneur.first_name,
              lastName: repreneur.last_name,
              email: repreneur.email,
            },
            metadata: {
              lastStep: form.last_step_completed || 1,
              daysAgo: daysAgo,
            },
          }),
        })

        // Update reminder count
        await supabase
          .from("intake_abandonment_tracking")
          .update({
            reminder_count: (form.reminder_count || 0) + 1,
            last_reminder_at: now.toISOString(),
          })
          .eq("id", form.id)

        sentCount++
      } catch (err) {
        const errorMsg = `Failed to send to ${repreneur.email}: ${err}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // === Second job on the same cron: pre-interview reminders ===
    // Hobby plan caps us at one cron/day, so we piggyback here. `activities.event_date`
    // is a DATE column (no time), so precision is whole-day: at 9am today we email
    // everyone whose interview is scheduled for tomorrow.
    let interviewSent = 0
    const interviewErrors: string[] = []
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
          const result = await sendEmail({
            to: rep.email,
            subject: "Rappel : votre entretien Re-New demain",
            repreneurId: rep.id,
            templateKey: "interview_reminder",
            bcc: INTERVIEW_REMINDER_BCC ? [INTERVIEW_REMINDER_BCC] : undefined,
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
          })
          if (result.success) interviewSent++
        } catch (err) {
          interviewErrors.push(`Interview reminder to ${rep.email}: ${err}`)
        }
      }
    } catch (err) {
      console.error("Interview reminder sub-job failed:", err)
      interviewErrors.push(String(err))
    }

    // === Third job on the same cron: Day-5 booking reminders ===
    // Fires once for repreneurs who applied >5 days ago AND have no interview
    // activity logged yet AND haven't already received a booking_reminder.
    // Cap at 30 days so stale leads are handled by the reactivation flow below
    // rather than receiving a surprise old booking nudge.
    let bookingSent = 0
    const bookingErrors: string[] = []
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
          const result = await sendEmail({
            to: c.email,
            subject: "Planifions un premier échange Re-New",
            repreneurId: c.id,
            templateKey: "booking_reminder",
            bcc: INTERVIEW_REMINDER_BCC ? [INTERVIEW_REMINDER_BCC] : undefined,
            react: BookingReminderEmail({
              repreneur: {
                id: c.id,
                firstName: c.first_name,
                lastName: c.last_name,
                email: c.email,
              },
            }),
          })
          if (result.success) bookingSent++
        } catch (err) {
          bookingErrors.push(`Booking reminder to ${c.email}: ${err}`)
        }
      }
    } catch (err) {
      console.error("Booking reminder sub-job failed:", err)
      bookingErrors.push(String(err))
    }

    // === Fourth job: auto-shift stale Leads to "to_reactivate" ===
    // Leads with no interview activity at all and created >30 days ago move
    // to a separate group so they stop polluting Bertrand's top funnel view.
    let staleShifted = 0
    const staleErrors: string[] = []
    try {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: staleCandidates } = await supabase
        .from("repreneurs")
        .select("id")
        .eq("lifecycle_status", "lead")
        .lte("created_at", thirtyDaysAgo)

      const candidateIds = (staleCandidates || []).map((r) => r.id)
      if (candidateIds.length > 0) {
        const { data: withInterview } = await supabase
          .from("activities")
          .select("repreneur_id")
          .eq("activity_type", "interview")
          .in("repreneur_id", candidateIds)
        const skip = new Set((withInterview || []).map((a) => a.repreneur_id))
        const toShift = candidateIds.filter((id) => !skip.has(id))
        if (toShift.length > 0) {
          const { error: shiftError } = await supabase
            .from("repreneurs")
            .update({ lifecycle_status: "to_reactivate" })
            .in("id", toShift)
          if (shiftError) {
            staleErrors.push(`Stale-lead shift: ${shiftError.message}`)
          } else {
            staleShifted = toShift.length
          }
        }
      }
    } catch (err) {
      console.error("Stale-lead shift sub-job failed:", err)
      staleErrors.push(String(err))
    }

    const allErrors = [...errors, ...interviewErrors, ...bookingErrors, ...staleErrors]
    return NextResponse.json({
      message: `abandoned: ${sentCount}; interview reminders: ${interviewSent}; booking reminders: ${bookingSent}; stale leads shifted: ${staleShifted}`,
      sent: sentCount,
      interviewSent,
      bookingSent,
      staleShifted,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (err) {
    console.error("Cron job error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
