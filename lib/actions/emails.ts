"use server"

import { createServerClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import type { EmailTemplateKey } from "@/lib/types/email"

// Import all email templates
import { WelcomeEmail } from "@/lib/email/templates/welcome"
import { FormStepCompleteEmail } from "@/lib/email/templates/form-step-complete"
import { AbandonedReminderEmail } from "@/lib/email/templates/abandoned-reminder"
import { ThankYouEmail } from "@/lib/email/templates/thank-you"
import { HighScoreAlertEmail } from "@/lib/email/templates/high-score-alert"
import { OfferReceivedEmail } from "@/lib/email/templates/offer-received"
import { MilestoneCompletedEmail } from "@/lib/email/templates/milestone-completed"
import { OfferAcceptedEmail } from "@/lib/email/templates/offer-accepted"
import { OfferActivatedEmail } from "@/lib/email/templates/offer-activated"
import { RejectionEmail } from "@/lib/email/templates/rejection"

export interface EmailStats {
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  openRate: number
  clickRate: number
  bounceRate: number
}

export interface EmailLogEntry {
  id: string
  repreneur_id: string
  repreneur_email: string
  repreneur_name: string
  template_key: EmailTemplateKey
  subject: string
  status: string
  sent_at: string
  opened_at: string | null
  clicked_at: string | null
}

/**
 * Get email analytics stats
 */
export async function getEmailStats(days: number = 30): Promise<EmailStats> {
  const supabase = await createServerClient()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data, error } = await supabase
    .from("email_logs")
    .select("status")
    .gte("sent_at", cutoffDate.toISOString())

  if (error || !data) {
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    }
  }

  const totalSent = data.length
  const totalDelivered = data.filter((e) => e.status === "delivered" || e.status === "opened" || e.status === "clicked").length
  const totalOpened = data.filter((e) => e.status === "opened" || e.status === "clicked").length
  const totalClicked = data.filter((e) => e.status === "clicked").length
  const totalBounced = data.filter((e) => e.status === "bounced").length

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
    clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
  }
}

/**
 * Get email logs with filters
 */
export async function getEmailLogs(options: {
  limit?: number
  offset?: number
  templateKey?: EmailTemplateKey
  status?: string
}) {
  const supabase = await createServerClient()
  const { limit = 50, offset = 0, templateKey, status } = options

  let query = supabase
    .from("email_logs")
    .select(`
      id,
      repreneur_id,
      template_key,
      subject,
      status,
      sent_at,
      opened_at,
      clicked_at,
      repreneurs!inner(
        email,
        first_name,
        last_name
      )
    `, { count: "exact" })
    .order("sent_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (templateKey) {
    query = query.eq("template_key", templateKey)
  }

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message)
  }

  const logs = data?.map((log) => {
    const repreneur = log.repreneurs as { email: string; first_name: string; last_name: string }
    return {
      id: log.id,
      repreneur_id: log.repreneur_id,
      repreneur_email: repreneur.email,
      repreneur_name: `${repreneur.first_name} ${repreneur.last_name}`,
      template_key: log.template_key as EmailTemplateKey,
      subject: log.subject,
      status: log.status,
      sent_at: log.sent_at,
      opened_at: log.opened_at,
      clicked_at: log.clicked_at,
    }
  }) || []

  return { logs, total: count || 0 }
}

/**
 * Get template settings from database
 */
export async function getTemplateSettings() {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("template_key")

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

/**
 * Toggle template enabled/disabled
 */
export async function toggleTemplateEnabled(templateKey: EmailTemplateKey, enabled: boolean) {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("email_templates")
    .update({ is_enabled: enabled })
    .eq("template_key", templateKey)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/emails")
}

/**
 * Update template subject/preview text
 */
export async function updateTemplateSettings(
  templateKey: EmailTemplateKey,
  settings: { subject_override?: string; preview_text?: string }
) {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("email_templates")
    .update(settings)
    .eq("template_key", templateKey)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/emails")
}

/**
 * Get list of repreneurs for manual send
 */
export async function getRepreneursForManualSend(search?: string) {
  const supabase = await createServerClient()

  let query = supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, marketing_consent")
    .order("last_name")
    .limit(50)

  if (search) {
    // Escape special SQL LIKE characters to prevent injection
    const escapedSearch = search
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
    query = query.or(`first_name.ilike.%${escapedSearch}%,last_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

/**
 * Manually send an email to a repreneur
 */
export async function sendManualEmail(
  repreneurId: string,
  templateKey: EmailTemplateKey,
  metadata?: Record<string, unknown>
) {
  const supabase = await createServerClient()

  // Get repreneur data
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .eq("id", repreneurId)
    .single()

  if (error || !repreneur) {
    throw new Error("Repreneur not found")
  }

  const emailData = {
    id: repreneur.id,
    firstName: repreneur.first_name,
    lastName: repreneur.last_name,
    email: repreneur.email,
  }

  // Build the template based on the key
  let template: React.ReactElement
  let subject: string

  switch (templateKey) {
    case "welcome":
      template = WelcomeEmail({ repreneur: emailData })
      subject = "Welcome to Re-New!"
      break
    case "form_step_complete":
      template = FormStepCompleteEmail({ repreneur: emailData, metadata })
      subject = "Your Re-New Progress"
      break
    case "abandoned_reminder":
      template = AbandonedReminderEmail({ repreneur: emailData, metadata })
      subject = "Complete Your Re-New Registration"
      break
    case "thank_you":
      template = ThankYouEmail({ repreneur: emailData, metadata })
      subject = "Thank You for Registering with Re-New!"
      break
    case "high_score_alert":
      template = HighScoreAlertEmail({ repreneur: emailData, metadata })
      subject = "Your Re-New Profile Stands Out!"
      break
    case "offer_received":
      template = OfferReceivedEmail({ repreneur: emailData, metadata })
      subject = "New Offer from Re-New"
      break
    case "milestone_completed":
      template = MilestoneCompletedEmail({ repreneur: emailData, metadata })
      subject = "Milestone Completed!"
      break
    case "offer_accepted":
      template = OfferAcceptedEmail({ repreneur: emailData, metadata })
      subject = "Offer Accepted"
      break
    case "offer_activated":
      template = OfferActivatedEmail({ repreneur: emailData, metadata })
      subject = "Your Engagement is Now Active!"
      break
    case "rejection":
      template = RejectionEmail({ repreneur: emailData })
      subject = "Update on Your Application"
      break
    default:
      throw new Error(`Unknown template: ${templateKey}`)
  }

  const result = await sendEmail({
    to: repreneur.email,
    subject,
    repreneurId: repreneur.id,
    templateKey,
    react: template,
  })

  revalidatePath("/emails")

  if (!result.success) {
    return { success: false, message: result.error || "Failed to send email" }
  }

  return { success: true, message: `Email sent to ${repreneur.email}` }
}

/**
 * Send a test email to any email address (for testing templates)
 * Does NOT log to database - for testing only
 * Returns result object instead of throwing to avoid Next.js error sanitization
 */
export async function sendTestEmail(
  email: string,
  firstName: string,
  templateKey: EmailTemplateKey
): Promise<{ success: boolean; message: string }> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { success: false, message: "Invalid email address" }
  }

  const emailData = {
    id: "test-user",
    firstName: firstName || "Test",
    lastName: "User",
    email: email,
  }

  // Sample metadata for templates that need it
  const metadata = {
    stepNumber: 2,
    totalSteps: 4,
    stepName: "Motivations",
    tier1Score: 85,
    offerName: "Starter Pack",
    offerPrice: "€2,500",
    milestoneName: "Profile Complete",
  }

  let template: React.ReactElement
  let subject: string

  switch (templateKey) {
    case "welcome":
      template = WelcomeEmail({ repreneur: emailData })
      subject = "[TEST] Welcome to Re-New!"
      break
    case "form_step_complete":
      template = FormStepCompleteEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Your Re-New Progress"
      break
    case "abandoned_reminder":
      template = AbandonedReminderEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Complete Your Re-New Registration"
      break
    case "thank_you":
      template = ThankYouEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Thank You for Registering with Re-New!"
      break
    case "high_score_alert":
      template = HighScoreAlertEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Your Re-New Profile Stands Out!"
      break
    case "offer_received":
      template = OfferReceivedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] New Offer from Re-New"
      break
    case "milestone_completed":
      template = MilestoneCompletedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Milestone Completed!"
      break
    case "offer_accepted":
      template = OfferAcceptedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Offer Accepted"
      break
    case "offer_activated":
      template = OfferActivatedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Your Engagement is Now Active!"
      break
    case "rejection":
      template = RejectionEmail({ repreneur: emailData })
      subject = "[TEST] Update on Your Application"
      break
    default:
      return { success: false, message: `Unknown template: ${templateKey}` }
  }

  // Use sendEmailDirect to send without logging
  const { sendEmailDirect } = await import("@/lib/email/send-email")
  const result = await sendEmailDirect({
    to: email,
    subject,
    react: template,
  })

  if (!result.success) {
    return { success: false, message: result.error || "Failed to send email" }
  }

  return { success: true, message: `Test email sent to ${email}` }
}

/**
 * Get daily email counts for chart
 */
export async function getDailyEmailCounts(days: number = 14) {
  const supabase = await createServerClient()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const { data, error } = await supabase
    .from("email_daily_counts")
    .select("date, count")
    .gte("date", cutoffDate.toISOString().split("T")[0])
    .order("date")

  if (error) {
    console.error("Error fetching daily counts:", error)
    return []
  }

  return data || []
}
