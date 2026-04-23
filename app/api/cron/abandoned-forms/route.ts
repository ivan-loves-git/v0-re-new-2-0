import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, wasEmailSent } from "@/lib/email"
import { AbandonedReminderEmail } from "@/lib/email/templates/abandoned-reminder"
import { InterviewReminderEmail } from "@/lib/email/templates/interview-reminder"

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

    if (!abandonedForms || abandonedForms.length === 0) {
      return NextResponse.json({ message: "No abandoned forms to process", sent: 0 })
    }

    let sentCount = 0
    const errors: string[] = []

    for (const form of abandonedForms) {
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

    // === Second job on the same cron: 24h pre-interview reminders ===
    // Hobby plan caps us at one cron/day, so we piggyback here. Looks for
    // interview activities with event_date roughly 24h in the future.
    let interviewSent = 0
    const interviewErrors: string[] = []
    try {
      const windowStart = new Date(now.getTime() + 22 * 60 * 60 * 1000)
      const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000)

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
        .gte("event_date", windowStart.toISOString())
        .lt("event_date", windowEnd.toISOString())

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

    return NextResponse.json({
      message: `Processed ${abandonedForms.length} abandoned forms; interview reminders sent: ${interviewSent}`,
      sent: sentCount,
      interviewSent,
      errors: errors.length + interviewErrors.length > 0
        ? [...errors, ...interviewErrors]
        : undefined,
    })
  } catch (err) {
    console.error("Cron job error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
