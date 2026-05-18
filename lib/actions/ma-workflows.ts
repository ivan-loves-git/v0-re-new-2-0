"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { MaIntermediaryEmail } from "@/lib/email/templates/ma-intermediary"
import { MA_TEMPLATE_DEFAULT_BODIES, TEMPLATE_METADATA } from "@/lib/email/templates"
import { getTemplateBody, getTemplateSubject } from "@/lib/actions/emails"
import type { EmailTemplateKey } from "@/lib/types/email"
import type { MaSourceInteraction, OpportunityMatchStatus } from "@/lib/types/opportunity"

const MA_TEMPLATE_KEYS = [
  "ma_opportunity_validity_check",
  "ma_request_more_information",
  "ma_repreneur_interest_feedback",
  "ma_process_follow_up",
] as const satisfies readonly EmailTemplateKey[]

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
  status: OpportunityMatchStatus
  updated_at: string
  repreneur?: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
}

export interface MaWorkflowDraft {
  templateKey: EmailTemplateKey
  name: string
  description: string
  subject: string
  body: string
}

export interface MaOpportunityWorkflow {
  recipientEmail: string | null
  sourceName: string
  contactName: string | null
  drafts: MaWorkflowDraft[]
  interactions: MaSourceInteraction[]
}

function isMaTemplateKey(value: string): value is EmailTemplateKey {
  return MA_TEMPLATE_KEYS.includes(value as EmailTemplateKey)
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

function bestMatch(matches: MatchRow[]) {
  const priority: OpportunityMatchStatus[] = ["active_pursuit", "interested", "proposed", "shortlisted", "draft"]
  return [...matches].sort((a, b) => {
    const priorityDiff = priority.indexOf(a.status) - priority.indexOf(b.status)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })[0] ?? null
}

function opportunityTitle(opportunity: OpportunityWorkflowRow) {
  return opportunity.public_title || opportunity.sector || opportunity.reference
}

function substituteTemplateVariables(value: string, variables: Record<string, string>) {
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })
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
      .select("status, updated_at, repreneur:repreneurs(first_name, last_name, email)")
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
  const variables = {
    firstName: opportunity.source?.contact_name?.split(/\s+/)[0] || "Bonjour",
    firmName: opportunity.source?.firm_name || opportunity.source_label || "votre cabinet",
    opportunityTitle: opportunityTitle(opportunity),
    repreneurName: repreneurName(match),
    nextStep: match?.status === "active_pursuit" ? "un echange avec le vendeur" : "un premier echange de qualification",
    sector: opportunity.sector || "secteur non precise",
    location: opportunity.location || "localisation non precise",
  }

  return { opportunity, variables }
}

export async function getMaOpportunityWorkflow(opportunityId: string): Promise<MaOpportunityWorkflow> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { opportunity, variables } = await loadOpportunityContext(opportunityId)

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

  return {
    recipientEmail: opportunity.source?.contact_email ?? null,
    sourceName: opportunity.source?.firm_name || opportunity.source_label || "No source",
    contactName: opportunity.source?.contact_name ?? null,
    drafts,
    interactions: ((data ?? []) as MaSourceInteraction[]),
  }
}

export async function sendMaSourceWorkflowEmail(
  opportunityId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()
  const templateKey = readString(formData, "template_key")
  const subject = readString(formData, "subject")
  const body = readString(formData, "body_markdown")

  if (!templateKey || !isMaTemplateKey(templateKey)) {
    return { success: false, message: "Choose an M&A email template." }
  }
  if (!subject) return { success: false, message: "Subject is required." }
  if (!body) return { success: false, message: "Message body is required." }

  const supabase = createAdminClient()
  const { opportunity, variables } = await loadOpportunityContext(opportunityId)
  const recipientEmail = opportunity.source?.contact_email

  if (!opportunity.source_id || !opportunity.source) {
    return { success: false, message: "This opportunity is not linked to an M&A source yet." }
  }
  if (!recipientEmail) {
    return { success: false, message: "Add a source contact email before sending an intermediary follow-up." }
  }

  const renderedSubject = substituteTemplateVariables(subject, variables)
  const renderedBody = substituteTemplateVariables(body, variables)

  const { sendEmailDirect } = await import("@/lib/email/send-email")
  const result = await sendEmailDirect({
    to: recipientEmail,
    subject: renderedSubject,
    react: MaIntermediaryEmail({
      subject: renderedSubject,
      body: renderedBody,
      variables,
    }),
  })

  const status = result.success ? "sent" : "failed"
  const { error } = await supabase.from("ma_source_interactions").insert({
    opportunity_id: opportunity.id,
    source_id: opportunity.source_id,
    template_key: templateKey,
    recipient_email: recipientEmail,
    subject: renderedSubject,
    body_markdown: renderedBody,
    status,
    error_message: result.success ? null : result.error ?? "Email send failed",
    sent_at: result.success ? new Date().toISOString() : null,
    created_by: access.user.id,
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

  if (!result.success) {
    return { success: false, message: result.error || "Email failed." }
  }

  return { success: true, message: `Email sent to ${recipientEmail}` }
}

