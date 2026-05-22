"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { MA_TEMPLATE_DEFAULT_BODIES, TEMPLATE_METADATA } from "@/lib/email/templates"
import { getTemplateBody, getTemplateSubject } from "@/lib/actions/emails"
import type { EmailTemplateKey } from "@/lib/types/email"
import type { MaSourceInteraction, OpportunityMatchStatus, OpportunityPursuitStage } from "@/lib/types/opportunity"

const MA_TEMPLATE_KEYS = [
  "ma_opportunity_validity_check",
  "ma_request_more_information",
  "ma_repreneur_interest_feedback",
  "ma_nda_info_memo_request",
  "ma_process_follow_up",
] as const satisfies readonly EmailTemplateKey[]

type MaTemplateKey = (typeof MA_TEMPLATE_KEYS)[number]
const INFO_MEMO_REMINDER_DAYS = 7

interface OpportunityWorkflowRow {
  id: string
  reference: string
  public_title: string | null
  sector: string | null
  activity: string | null
  location: string | null
  source_id: string | null
  source_label: string | null
  source?: {
    id: string
    firm_name: string
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
  } | null
}

interface MatchRow {
  id: string
  status: OpportunityMatchStatus
  pursuit_stage: OpportunityPursuitStage | null
  pursuit_stage_updated_at: string | null
  updated_at: string
  repreneur?: {
    first_name: string | null
    last_name: string | null
    email: string | null
    lifecycle_status?: string | null
    journey_stage?: string | null
    recommendation?: string | null
    who_score?: number | null
    when_score?: number | null
    q12_geo_zones?: unknown
    q13_target_sectors_v2?: unknown
    q14_deal_size?: unknown
    q16_equity?: string | null
  } | null
}

export interface MaWorkflowDraft {
  templateKey: MaTemplateKey
  name: string
  description: string
  subject: string
  body: string
}

export interface MaOpportunityWorkflow {
  recipientEmail: string | null
  sourceName: string
  contactName: string | null
  recommendedTemplateKey: MaTemplateKey | null
  activePursuitName: string | null
  stalledReminder: {
    title: string
    message: string
  } | null
  drafts: MaWorkflowDraft[]
  interactions: MaSourceInteraction[]
}

function isMaTemplateKey(value: string): value is MaTemplateKey {
  return MA_TEMPLATE_KEYS.includes(value as MaTemplateKey)
}

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeSource(row: any): OpportunityWorkflowRow {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  return { ...row, source: source ?? null } as OpportunityWorkflowRow
}

function repreneurName(match: MatchRow | null) {
  const repreneur = match?.repreneur
  const name = [repreneur?.first_name, repreneur?.last_name].filter(Boolean).join(" ")
  return name || repreneur?.email || "un repreneur qualifie"
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

function compactLine(label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null
  return `- ${label}: ${value}`
}

function formatRepreneurProfile(match: MatchRow | null) {
  const repreneur = match?.repreneur
  if (!repreneur) return "Profil repreneur a completer dans Re-New."

  const lines = [
    compactLine("Nom", repreneurName(match)),
    compactLine("Email", repreneur.email),
    compactLine("Statut", repreneur.lifecycle_status),
    compactLine("Etape", repreneur.journey_stage),
    compactLine("Recommendation Re-New", repreneur.recommendation),
    compactLine("Score profil", repreneur.who_score),
    compactLine("Score projet", repreneur.when_score),
    compactLine("Zones ciblees", asList(repreneur.q12_geo_zones).join(", ")),
    compactLine("Secteurs cibles", asList(repreneur.q13_target_sectors_v2).join(", ")),
    compactLine("Taille de deal ciblee", asList(repreneur.q14_deal_size).join(", ")),
    compactLine("Apport personnel", repreneur.q16_equity),
  ].filter(Boolean)

  return lines.length > 0 ? lines.join("\n") : "Profil repreneur a completer dans Re-New."
}

function bestMatch(matches: MatchRow[]) {
  const priority: OpportunityMatchStatus[] = ["active_pursuit", "interested", "proposed", "shortlisted", "draft"]
  return [...matches].sort((a, b) => {
    const priorityDiff = priority.indexOf(a.status) - priority.indexOf(b.status)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })[0] ?? null
}

function activePursuit(matches: MatchRow[]) {
  return matches.find((match) => match.status === "active_pursuit") ?? null
}

function opportunityTitle(opportunity: OpportunityWorkflowRow) {
  return opportunity.public_title || opportunity.sector || opportunity.reference
}

function substituteTemplateVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function markdownToEmailHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("")
}

async function sendIntermediaryEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "Email service not configured" }
  }

  const sendPromise = resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html: markdownToEmailHtml(body),
    text: body,
  })

  const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) => {
    setTimeout(() => resolve({ error: { message: "Email provider timed out" } }), 15000)
  })

  const { error } = await Promise.race([sendPromise, timeoutPromise])
  return error ? { success: false, error: error.message } : { success: true }
}

async function loadOpportunityContext(opportunityId: string) {
  const supabase = createAdminClient()
  const [{ data: opportunityRow, error: opportunityError }, { data: matchRows, error: matchError }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, reference, public_title, sector, activity, location, source_id, source_label, source:ma_sources(id, firm_name, contact_name, contact_email, contact_phone)")
      .eq("id", opportunityId)
      .single(),
    supabase
      .from("opportunity_matches")
      .select(`
        id,
        status,
        pursuit_stage,
        pursuit_stage_updated_at,
        updated_at,
        repreneur:repreneurs(
          first_name,
          last_name,
          email,
          lifecycle_status,
          journey_stage,
          recommendation,
          who_score,
          when_score,
          q12_geo_zones,
          q13_target_sectors_v2,
          q14_deal_size,
          q16_equity
        )
      `)
      .eq("opportunity_id", opportunityId)
      .order("updated_at", { ascending: false }),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (matchError) throw new Error(matchError.message)

  const opportunity = normalizeSource(opportunityRow)
  const matches = ((matchRows ?? []) as any[]).map((row) => ({
    ...row,
    repreneur: Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
  })) as MatchRow[]

  const match = bestMatch(matches)
  const activeMatch = activePursuit(matches)
  const profileMatch = activeMatch ?? match
  const variables = {
    firstName: opportunity.source?.contact_name?.split(/\s+/)[0] || "Bonjour",
    firmName: opportunity.source?.firm_name || opportunity.source_label || "votre cabinet",
    opportunityTitle: opportunityTitle(opportunity),
    repreneurName: repreneurName(profileMatch),
    repreneurProfile: formatRepreneurProfile(profileMatch),
    nextStep: match?.status === "active_pursuit" ? "un echange avec le vendeur" : "un premier echange de qualification",
    sector: opportunity.sector || "secteur non precise",
    location: opportunity.location || "localisation non precise",
  }

  return { opportunity, variables, activeMatch }
}

function daysSince(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function deriveStalledReminder(activeMatch: MatchRow | null, interactions: MaSourceInteraction[]) {
  if (!activeMatch || activeMatch.pursuit_stage === "info_memo_received") return null
  if (activeMatch.pursuit_stage && activeMatch.pursuit_stage !== "interest") return null

  const ndaRequest = interactions.find((interaction) => interaction.template_key === "ma_nda_info_memo_request")
  const referenceDate = ndaRequest?.sent_at ?? ndaRequest?.created_at ?? activeMatch.pursuit_stage_updated_at ?? activeMatch.updated_at
  const stalledDays = daysSince(referenceDate)
  if (stalledDays === null || stalledDays < INFO_MEMO_REMINDER_DAYS) return null

  if (ndaRequest) {
    return {
      title: "NDA/info memo follow-up due",
      message: `The NDA/info memo request was sent ${stalledDays} days ago and the pursuit is still before info memo received.`,
    }
  }

  return {
    title: "NDA/info memo request due",
    message: `This pursuit has been active for ${stalledDays} days without a logged NDA/info memo request.`,
  }
}

export async function getMaOpportunityWorkflow(opportunityId: string): Promise<MaOpportunityWorkflow> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { opportunity, variables, activeMatch } = await loadOpportunityContext(opportunityId)

  const drafts = await Promise.all(
    MA_TEMPLATE_KEYS.map(async (templateKey) => {
      const metadata = TEMPLATE_METADATA[templateKey]
      const subject = await getTemplateSubject(templateKey, metadata.name)
      const body = (await getTemplateBody(templateKey)) || MA_TEMPLATE_DEFAULT_BODIES[templateKey] || ""
      return {
        templateKey,
        name: metadata.name,
        description: metadata.description,
        subject: substituteTemplateVariables(subject, variables),
        body: substituteTemplateVariables(body, variables),
      }
    }),
  )

  const { data, error } = await supabase
    .from("ma_source_interactions")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(8)

  if (error && error.code !== "42P01") throw new Error(error.message)
  const interactions = ((data ?? []) as MaSourceInteraction[])

  return {
    recipientEmail: opportunity.source?.contact_email ?? null,
    sourceName: opportunity.source?.firm_name || opportunity.source_label || "No source",
    contactName: opportunity.source?.contact_name ?? null,
    recommendedTemplateKey: activeMatch ? "ma_nda_info_memo_request" : null,
    activePursuitName: repreneurName(activeMatch),
    stalledReminder: deriveStalledReminder(activeMatch, interactions),
    drafts,
    interactions,
  }
}

export async function sendMaSourceWorkflowEmail(
  opportunityId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const templateKey = readString(formData, "template_key")
  const subject = readString(formData, "subject")
  const body = readString(formData, "body_markdown")

  return sendMaSourceWorkflowEmailPayload(opportunityId, {
    templateKey,
    subject,
    body,
  })
}

export async function sendMaSourceWorkflowEmailPayload(
  opportunityId: string,
  payload: {
    templateKey: string | null
    subject: string | null
    body: string | null
  },
): Promise<{ success: boolean; message: string }> {
  await requireStaffAccess()
  const { templateKey, subject, body } = payload

  if (!templateKey || !isMaTemplateKey(templateKey)) {
    return { success: false, message: "Choose an M&A email template." }
  }
  if (!subject) return { success: false, message: "Subject is required." }
  if (!body) return { success: false, message: "Message body is required." }

  const supabase = createAdminClient()
  const { opportunity, variables, activeMatch } = await loadOpportunityContext(opportunityId)
  const recipientEmail = opportunity.source?.contact_email

  if (templateKey === "ma_nda_info_memo_request" && !activeMatch) {
    return { success: false, message: "Validate a repreneur pursuit before requesting the M&A firm's NDA/info memo." }
  }

  if (!opportunity.source_id || !opportunity.source) {
    return { success: false, message: "This opportunity is not linked to an M&A source yet." }
  }
  if (!recipientEmail) {
    return { success: false, message: "Add a source contact email before sending an intermediary follow-up." }
  }

  const renderedSubject = substituteTemplateVariables(subject, variables)
  const renderedBody = substituteTemplateVariables(body, variables)

  const result = await sendIntermediaryEmail({
    to: recipientEmail,
    subject: renderedSubject,
    body: renderedBody,
  })

  const status = result.success ? "sent" : "failed"
  const { error } = await supabase.from("ma_source_interactions").insert({
    opportunity_id: opportunity.id,
    source_id: opportunity.source_id,
    template_key: templateKey,
    channel: "email",
    direction: "outbound",
    recipient_email: recipientEmail,
    subject: renderedSubject,
    body_markdown: renderedBody,
    status,
    error_message: result.success ? null : result.error ?? "Email send failed",
    sent_at: result.success ? new Date().toISOString() : null,
  })

  if (error) {
    return {
      success: false,
      message: result.success
        ? "Email sent, but the interaction could not be logged."
        : result.error || "Email failed and the interaction could not be logged.",
    }
  }

  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/opportunities/ma")
  revalidatePath("/emails")
  revalidateOpportunityDashboardTags()

  if (!result.success) {
    return { success: false, message: result.error || "Email failed." }
  }

  return { success: true, message: `Email sent to ${recipientEmail}` }
}
