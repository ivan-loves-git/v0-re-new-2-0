"use server"

import { resend, FROM_EMAIL, FROM_NAME, DAILY_EMAIL_LIMIT } from "./resend-client"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EmailTemplateKey, EmailSendResult, EmailLog_Insert } from "@/lib/types/email"
import type { ReactElement } from "react"

interface SendEmailParams {
  to: string
  subject: string
  repreneurId: string
  templateKey: EmailTemplateKey
  react: ReactElement
  metadata?: Record<string, unknown>
  requiresConsent?: boolean // For explicit consent check (overrides template setting)
}

/**
 * Check if we can send more emails today (rate limiting)
 */
async function checkDailyLimit(): Promise<boolean> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data } = await supabase
    .from("email_daily_counts")
    .select("count")
    .eq("date", today)
    .single()

  return !data || data.count < DAILY_EMAIL_LIMIT
}

/**
 * Increment daily email counter
 */
async function incrementDailyCount(): Promise<void> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  // Upsert: insert or increment
  await supabase.rpc("increment_email_count", { target_date: today })
    .then(() => {})
    .catch(async () => {
      // Fallback if RPC doesn't exist: manual upsert
      const { data: existing } = await supabase
        .from("email_daily_counts")
        .select("count")
        .eq("date", today)
        .single()

      if (existing) {
        await supabase
          .from("email_daily_counts")
          .update({ count: existing.count + 1 })
          .eq("date", today)
      } else {
        await supabase
          .from("email_daily_counts")
          .insert({ date: today, count: 1 })
      }
    })
}

/**
 * Check if repreneur has given marketing consent
 * Only required for marketing emails (abandoned_reminder, high_score_alert, form_step_complete)
 */
async function checkMarketingConsent(
  repreneurId: string,
  templateKey: EmailTemplateKey
): Promise<boolean> {
  const supabase = createAdminClient()

  // Check if this template requires consent
  const { data: template } = await supabase
    .from("email_templates")
    .select("requires_consent")
    .eq("template_key", templateKey)
    .single()

  if (!template?.requires_consent) {
    return true // Transactional email, no consent needed
  }

  // Check repreneur's consent
  const { data: repreneur } = await supabase
    .from("repreneurs")
    .select("marketing_consent")
    .eq("id", repreneurId)
    .single()

  return repreneur?.marketing_consent === true
}

/**
 * Check if template is active
 */
async function isTemplateActive(templateKey: EmailTemplateKey): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: template } = await supabase
    .from("email_templates")
    .select("is_active")
    .eq("template_key", templateKey)
    .single()

  return template?.is_active !== false
}

/**
 * Log email to database
 */
async function logEmail(log: EmailLog_Insert): Promise<string | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("email_logs")
    .insert(log)
    .select("id")
    .single()

  if (error) {
    console.error("Failed to log email:", error)
    return null
  }

  return data.id
}

/**
 * Update email log status
 */
async function updateEmailLogStatus(
  emailLogId: string,
  updates: {
    status?: string
    resend_id?: string
    sent_at?: string
    error_message?: string
  }
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from("email_logs")
    .update(updates)
    .eq("id", emailLogId)
}

/**
 * Main function to send an email
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  const { to, subject, repreneurId, templateKey, react, metadata = {} } = params

  // Check API key at runtime
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set. Email sending disabled.")
    return { success: false, error: "Email service not configured" }
  }

  try {
    // 1. Check if template is active
    const templateActive = await isTemplateActive(templateKey)
    if (!templateActive) {
      return { success: false, error: "Template is disabled" }
    }

    // 2. Check marketing consent if required
    const hasConsent = await checkMarketingConsent(repreneurId, templateKey)
    if (!hasConsent) {
      return { success: false, error: "Marketing consent not granted" }
    }

    // 3. Check daily rate limit
    const withinLimit = await checkDailyLimit()
    if (!withinLimit) {
      return { success: false, error: "Daily email limit reached" }
    }

    // 4. Create email log (pending)
    const emailLogId = await logEmail({
      repreneur_id: repreneurId,
      template_key: templateKey,
      to_email: to,
      subject,
      status: "pending",
      metadata,
    })

    if (!emailLogId) {
      return { success: false, error: "Failed to create email log" }
    }

    // 5. Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      react,
    })

    if (error) {
      await updateEmailLogStatus(emailLogId, {
        status: "failed",
        error_message: error.message,
      })
      return { success: false, emailLogId, error: error.message }
    }

    // 6. Update log with success
    await updateEmailLogStatus(emailLogId, {
      status: "sent",
      resend_id: data?.id,
      sent_at: new Date().toISOString(),
    })

    // 7. Increment daily counter
    await incrementDailyCount()

    return {
      success: true,
      emailLogId,
      resendId: data?.id,
    }
  } catch (err) {
    console.error("Error sending email:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Direct email send without logging (for testing purposes)
 */
export async function sendEmailDirect(params: {
  to: string
  subject: string
  react: ReactElement
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, react } = params

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set. Email sending disabled.")
    return { success: false, error: "Email service not configured" }
  }

  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      react,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error("Error sending test email:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Check if an email was already sent to avoid duplicates
 * Useful for preventing re-sending welcome emails, etc.
 * @param repreneurId - The repreneur to check
 * @param templateKey - The email template type
 * @param withinMinutes - Optional: only check emails sent within this time window
 */
export async function wasEmailSent(
  repreneurId: string,
  templateKey: EmailTemplateKey,
  withinMinutes?: number
): Promise<boolean> {
  const supabase = createAdminClient()

  let query = supabase
    .from("email_logs")
    .select("id")
    .eq("repreneur_id", repreneurId)
    .eq("template_key", templateKey)
    .in("status", ["sent", "delivered", "opened", "clicked"])

  // Add time filter if specified
  if (withinMinutes) {
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes)
    query = query.gte("sent_at", cutoffTime.toISOString())
  }

  const { data } = await query.limit(1)

  return (data?.length ?? 0) > 0
}

/**
 * Get email statistics for analytics
 */
export async function getEmailStats(
  dateFrom?: Date,
  dateTo?: Date
): Promise<{
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
}> {
  const supabase = createAdminClient()

  let query = supabase.from("email_logs").select("status")

  if (dateFrom) {
    query = query.gte("created_at", dateFrom.toISOString())
  }
  if (dateTo) {
    query = query.lte("created_at", dateTo.toISOString())
  }

  const { data } = await query

  if (!data) {
    return { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 }
  }

  return {
    total: data.length,
    delivered: data.filter((e) => ["delivered", "opened", "clicked"].includes(e.status)).length,
    opened: data.filter((e) => ["opened", "clicked"].includes(e.status)).length,
    clicked: data.filter((e) => e.status === "clicked").length,
    bounced: data.filter((e) => e.status === "bounced").length,
    failed: data.filter((e) => e.status === "failed").length,
  }
}
