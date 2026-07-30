"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { sendEmail } from "@/lib/email"
import { revalidatePath } from "next/cache"
import { render } from "@react-email/render"
import type { EmailTemplateKey } from "@/lib/types/email"
import { MA_TEMPLATE_DEFAULT_BODIES, TEMPLATE_METADATA } from "@/lib/email/templates"
import { getSuppressedMaContactEmailAddresses } from "@/lib/email/ma-contact-email-authorization"

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
import { InterviewReminderEmail } from "@/lib/email/templates/interview-reminder"
import { BookingReminderEmail } from "@/lib/email/templates/booking-reminder"
import { MaIntermediaryEmail } from "@/lib/email/templates/ma-intermediary"

const MA_SAMPLE_VARIABLES = {
  firstName: "Camille",
  firmName: "Cabinet Atlantique M&A",
  opportunityTitle: "PME industrielle en region Ouest",
  repreneurName: "Sophie Martin",
  repreneurProfile: "- Nom: Sophie Martin\n- Email: sophie.martin@example.com\n- Score profil: 82\n- Score projet: 76",
  nextStep: "un premier echange cette semaine",
}

function isMaTemplateKey(templateKey: EmailTemplateKey) {
  return TEMPLATE_METADATA[templateKey]?.category === "ma"
}

function substituteTemplateVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })
}

function getMaTemplateBody(templateKey: EmailTemplateKey, bodyMarkdown?: string | null) {
  return bodyMarkdown?.trim() || MA_TEMPLATE_DEFAULT_BODIES[templateKey] || ""
}

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
  await requireStaffAccess()
  const supabase = createAdminClient()
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
  await requireStaffAccess()
  const supabase = createAdminClient()
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
    const repreneurRow = Array.isArray(log.repreneurs) ? log.repreneurs[0] : log.repreneurs
    const repreneur = repreneurRow as { email: string; first_name: string; last_name: string }
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
  await requireStaffAccess()
  const supabase = createAdminClient()

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
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("email_templates")
    .update({ is_active: enabled })
    .eq("template_key", templateKey)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/emails")
}

/**
 * Update template settings (subject and/or body_markdown).
 * Only fields that are explicitly passed are updated.
 */
export async function updateTemplateSettings(
  templateKey: EmailTemplateKey,
  settings: { subject?: string; preview_text?: string; body_markdown?: string }
) {
  await requireStaffAccess()
  const supabase = createAdminClient()

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
 * Fetch the editable body markdown for a template at send time.
 * Returns null if the template is not body-editable or has no body set.
 */
export async function getTemplateBody(templateKey: EmailTemplateKey): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("email_templates")
      .select("body_markdown, body_editable")
      .eq("template_key", templateKey)
      .single()
    if (!data?.body_editable) return null
    const body = (data?.body_markdown ?? "").trim()
    return body || null
  } catch {
    return null
  }
}

/**
 * Resolve the subject line for a template at send time.
 * Reads from email_templates.subject in the DB, falling back to the
 * hardcoded value if the DB lookup fails.
 */
export async function getTemplateSubject(
  templateKey: EmailTemplateKey,
  fallback: string,
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("email_templates")
      .select("subject")
      .eq("template_key", templateKey)
      .single()
    return (data?.subject?.trim()) || fallback
  } catch {
    return fallback
  }
}

/**
 * Render an email template to HTML for in-app preview.
 * Uses sample data so the preview is realistic without targeting a real repreneur.
 */
export async function getRenderedTemplate(
  templateKey: EmailTemplateKey,
): Promise<{ subject: string; html: string; bodyMarkdown: string | null; bodyEditable: boolean }> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from("email_templates")
    .select("subject, body_markdown, body_editable")
    .eq("template_key", templateKey)
    .single()
  const subject = row?.subject || TEMPLATE_METADATA[templateKey]?.name || ""
  const bodyEditable = !!row?.body_editable
  const fallbackBody = MA_TEMPLATE_DEFAULT_BODIES[templateKey] ?? null
  const bodyMarkdown: string | null = bodyEditable ? (row?.body_markdown?.trim() || fallbackBody) : null
  const bodyOverride = bodyMarkdown ?? undefined

  const sampleRepreneur = {
    id: "preview",
    firstName: "Sophie",
    lastName: "Martin",
    email: "sophie.martin@example.com",
  }
  let element: React.ReactElement
  switch (templateKey) {
    case "welcome":
      element = WelcomeEmail({ repreneur: sampleRepreneur, bodyOverride })
      break
    case "form_step_complete":
      element = FormStepCompleteEmail({ repreneur: sampleRepreneur, metadata: { stepCompleted: 2 } })
      break
    case "abandoned_reminder":
      element = AbandonedReminderEmail({
        repreneur: sampleRepreneur,
        metadata: { lastStep: 2, totalSteps: 4, daysAgo: 2 },
      })
      break
    case "thank_you":
      element = ThankYouEmail({
        repreneur: sampleRepreneur,
        metadata: { whoScore: 85, whenScore: 70, recommendation: "interview" },
      })
      break
    case "high_score_alert":
      element = HighScoreAlertEmail({
        repreneur: sampleRepreneur,
        metadata: { whoScore: 85, whenScore: 70, recommendation: "interview" },
      })
      break
    case "offer_received":
      element = OfferReceivedEmail({
        repreneur: sampleRepreneur,
        metadata: { offerName: "Starter Pack", offerPrice: 2500 },
      })
      break
    case "milestone_completed":
      element = MilestoneCompletedEmail({
        repreneur: sampleRepreneur,
        metadata: { milestoneTitle: "Profile Complete", offerName: "Starter Pack" },
      })
      break
    case "offer_accepted":
      element = OfferAcceptedEmail({
        repreneur: sampleRepreneur,
        metadata: { offerName: "Starter Pack" },
      })
      break
    case "offer_activated":
      element = OfferActivatedEmail({
        repreneur: sampleRepreneur,
        metadata: { offerName: "Starter Pack", startDate: new Date().toISOString() },
      })
      break
    case "rejection":
      element = RejectionEmail({ repreneur: sampleRepreneur })
      break
    case "interview_reminder":
      element = InterviewReminderEmail({
        repreneur: sampleRepreneur,
        metadata: { interviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      })
      break
    case "booking_reminder":
      element = BookingReminderEmail({ repreneur: sampleRepreneur, bodyOverride })
      break
    case "ma_opportunity_validity_check":
    case "ma_request_more_information":
    case "ma_repreneur_interest_feedback":
    case "ma_nda_info_memo_request":
    case "ma_process_follow_up":
      element = MaIntermediaryEmail({
        subject: substituteTemplateVariables(subject, MA_SAMPLE_VARIABLES),
        body: getMaTemplateBody(templateKey, bodyMarkdown),
        variables: MA_SAMPLE_VARIABLES,
      })
      break
    default:
      throw new Error(`Unknown template: ${templateKey}`)
  }

  const html = await render(element)
  return { subject, html, bodyMarkdown, bodyEditable }
}

/**
 * Get list of repreneurs for manual send
 */
export async function getRepreneursForManualSend(search?: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

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

  const candidates = data || []
  const suppressedEmails = await getSuppressedMaContactEmailAddresses()
  return candidates.filter((repreneur) => {
    const normalizedEmail = repreneur.email?.trim().toLowerCase()
    return !normalizedEmail || !suppressedEmails.has(normalizedEmail)
  })
}

/**
 * Manually send an email to a repreneur
 */
export async function sendManualEmail(
  repreneurId: string,
  templateKey: EmailTemplateKey,
  metadata?: Record<string, unknown>
) {
  await requireStaffAccess()
  if (TEMPLATE_METADATA[templateKey]?.audience !== "rep") {
    return {
      success: false,
      message: "This template is for M&A/intermediary workflows and is only available in test mode for now.",
    }
  }

  const supabase = createAdminClient()

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
      subject = "Bienvenue chez Re-New"
      break
    case "form_step_complete":
      template = FormStepCompleteEmail({ repreneur: emailData, metadata })
      subject = "Votre progression Re-New"
      break
    case "abandoned_reminder":
      template = AbandonedReminderEmail({ repreneur: emailData, metadata })
      subject = "Finalisez votre profil repreneur"
      break
    case "thank_you":
      template = ThankYouEmail({ repreneur: emailData, metadata })
      subject = "Merci pour votre inscription Re-New"
      break
    case "high_score_alert":
      template = HighScoreAlertEmail({ repreneur: emailData, metadata })
      subject = "Votre profil Re-New se distingue"
      break
    case "offer_received":
      template = OfferReceivedEmail({ repreneur: emailData, metadata })
      subject = "L'offre de Re-New adaptée à votre projet"
      break
    case "milestone_completed":
      template = MilestoneCompletedEmail({ repreneur: emailData, metadata })
      subject = "Étape franchie !"
      break
    case "offer_accepted":
      template = OfferAcceptedEmail({ repreneur: emailData, metadata })
      subject = "Offre acceptée"
      break
    case "offer_activated":
      template = OfferActivatedEmail({ repreneur: emailData, metadata })
      subject = "Votre accompagnement est actif"
      break
    case "rejection":
      template = RejectionEmail({ repreneur: emailData })
      subject = "Suite à la revue de votre dossier repreneur"
      break
    case "interview_reminder":
      template = InterviewReminderEmail({
        repreneur: emailData,
        metadata: {
          interviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      subject = "Rappel de votre entretien Re-New"
      break
    case "booking_reminder":
      template = BookingReminderEmail({
        repreneur: emailData,
        bodyOverride: await getTemplateBody(templateKey),
      })
      subject = "Planifiez votre entretien Re-New"
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
  await requireStaffAccess()
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
    stepCompleted: 2,
    lastStep: 2,
    stepNumber: 2,
    totalSteps: 6,
    daysAgo: 1,
    stepName: "Motivations",
    tier1Score: 85,
    whoScore: 82,
    whenScore: 76,
    recommendation: "deal_flow",
    offerName: "Starter Pack",
    offerPrice: 2500,
    milestoneTitle: "Profile Complete",
    milestoneName: "Profile Complete",
    startDate: new Date().toISOString(),
  }

  let template: React.ReactElement
  let subject: string

  if (isMaTemplateKey(templateKey)) {
    const variables = {
      ...MA_SAMPLE_VARIABLES,
      firstName: firstName || MA_SAMPLE_VARIABLES.firstName,
    }
    const baseSubject = await getTemplateSubject(templateKey, TEMPLATE_METADATA[templateKey].name)
    const body = getMaTemplateBody(templateKey, await getTemplateBody(templateKey))
    const renderedSubject = substituteTemplateVariables(baseSubject, variables)
    const { sendEmailDirect } = await import("@/lib/email/send-email")
    const result = await sendEmailDirect({
      to: email,
      subject: `[TEST] ${renderedSubject}`,
      react: MaIntermediaryEmail({
        subject: renderedSubject,
        body,
        variables,
      }),
    })

    if (!result.success) {
      return { success: false, message: result.error || "Failed to send email" }
    }

    return { success: true, message: `Test email sent to ${email}` }
  }

  switch (templateKey) {
    case "welcome":
      template = WelcomeEmail({ repreneur: emailData })
      subject = "[TEST] Bienvenue chez Re-New"
      break
    case "form_step_complete":
      template = FormStepCompleteEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Votre progression Re-New"
      break
    case "abandoned_reminder":
      template = AbandonedReminderEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Finalisez votre profil repreneur"
      break
    case "thank_you":
      template = ThankYouEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Merci pour votre inscription Re-New"
      break
    case "high_score_alert":
      template = HighScoreAlertEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Votre profil Re-New se distingue"
      break
    case "offer_received":
      template = OfferReceivedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] L'offre de Re-New adaptée à votre projet"
      break
    case "milestone_completed":
      template = MilestoneCompletedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Étape franchie !"
      break
    case "offer_accepted":
      template = OfferAcceptedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Offre acceptée"
      break
    case "offer_activated":
      template = OfferActivatedEmail({ repreneur: emailData, metadata })
      subject = "[TEST] Votre accompagnement est actif"
      break
    case "rejection":
      template = RejectionEmail({ repreneur: emailData })
      subject = "[TEST] Suite à la revue de votre dossier repreneur"
      break
    case "interview_reminder":
      template = InterviewReminderEmail({
        repreneur: emailData,
        metadata: { interviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      })
      subject = "[TEST] Rappel de votre entretien Re-New"
      break
    case "booking_reminder":
      template = BookingReminderEmail({
        repreneur: emailData,
        bodyOverride: await getTemplateBody(templateKey),
      })
      subject = "[TEST] Planifiez votre entretien Re-New"
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
  await requireStaffAccess()
  const supabase = createAdminClient()
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
