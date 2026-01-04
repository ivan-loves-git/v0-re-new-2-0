import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, wasEmailSent } from "@/lib/email"
import { AbandonedReminderEmail } from "@/lib/email/templates/abandoned-reminder"

// Vercel Cron: runs every hour
// cron: 0 * * * *

const ABANDONMENT_HOURS = 48 // Send reminder after 48 hours
const MAX_REMINDERS_PER_REPRENEUR = 2

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
    // - Last activity more than 48 hours ago
    // - Have marketing consent (GDPR compliant)
    // - Haven't received max reminders
    const { data: abandonedForms, error } = await supabase
      .from("intake_abandonment_tracking")
      .select(`
        id,
        repreneur_id,
        last_step_completed,
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
              lastStepCompleted: form.last_step_completed,
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

    return NextResponse.json({
      message: `Processed ${abandonedForms.length} abandoned forms`,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error("Cron job error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
