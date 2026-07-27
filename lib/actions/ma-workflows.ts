"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import {
  MA_TEMPLATE_DEFAULT_BODIES,
  TEMPLATE_METADATA,
} from "@/lib/email/templates"
import { getTemplateBody, getTemplateSubject } from "@/lib/actions/emails"
import { canAccessOpportunityMemo } from "@/lib/opportunity-confidentiality"
import { deriveMaWorkflowRecommendation } from "@/lib/utils/ma-workflow-recommendations"
import type { EmailTemplateKey } from "@/lib/types/email"
import type {
  MaSourceInteraction,
  OpportunityMatchStatus,
  OpportunityNdaStatus,
  OpportunityPursuitStage,
} from "@/lib/types/opportunity"

const MA_TEMPLATE_KEYS = [
  "ma_opportunity_validity_check",
  "ma_request_more_information",
  "ma_repreneur_interest_feedback",
  "ma_nda_info_memo_request",
  "ma_process_follow_up",
] as const satisfies readonly EmailTemplateKey[]

type MaTemplateKey = (typeof MA_TEMPLATE_KEYS)[number]

interface OpportunityWorkflowRow {
  id: string
  reference: string
  status: string
  public_title: string | null
  sector: string | null
  activity: string | null
  location: string | null
  date_added: string | null
  created_at: string
  updated_at: string
  source_id: string | null
  source_office_id: string | null
  source_label: string | null
  source?: {
    id: string
    firm_name: string
  } | null
  source_contacts?: OpportunityWorkflowContactRow[]
  source_office?: OpportunityWorkflowOfficeRow | null
  office_contacts?: OpportunityWorkflowCanonicalContactRow[]
}

interface OpportunityWorkflowOfficeRow {
  id: string
  name: string
  firm?: {
    id: string
    name: string
  } | null
}

interface OpportunityWorkflowContactRow {
  contact_id: string
  is_primary: boolean
  contact_name_snapshot: string | null
  contact_email_snapshot: string | null
  contact_phone_snapshot: string | null
  contact?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

interface OpportunityWorkflowCanonicalContactRow {
  id: string
  affiliation_id: string
  legacy_source_contact_id: string | null
  is_primary: boolean
  is_active: boolean
  contact_name_snapshot: string | null
  contact_email_snapshot: string | null
  contact_phone_snapshot: string | null
  affiliation?: {
    id: string
    office_id: string
    contact?: {
      id: string
      display_name: string | null
      email: string | null
      phone: string | null
    } | null
  } | null
}

interface MatchRow {
  id: string
  status: OpportunityMatchStatus
  pursuit_stage: OpportunityPursuitStage | null
  pursuit_stage_updated_at: string | null
  nda_status: OpportunityNdaStatus | null
  nda_signed_at: string | null
  nda_waived_at: string | null
  nda_waived_by: string | null
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

type MatchQueryRow = Omit<MatchRow, "repreneur"> & {
  repreneur?: MatchRow["repreneur"] | MatchRow["repreneur"][] | null
}

export interface MaWorkflowDraft {
  templateKey: MaTemplateKey
  name: string
  description: string
  subject: string
  body: string
}

export interface MaWorkflowContact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  legacySourceContactId?: string | null
}

export interface MaOpportunityWorkflow {
  contacts: MaWorkflowContact[]
  recipientContactId: string | null
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

function normalizeSource(row: Record<string, unknown>): OpportunityWorkflowRow {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  const sourceOffice = Array.isArray(row.source_office)
    ? row.source_office[0]
    : row.source_office
  const sourceContacts = Array.isArray(row.source_contacts)
    ? row.source_contacts
    : []
  const officeContacts = Array.isArray(row.office_contacts)
    ? row.office_contacts
    : []
  return {
    ...row,
    source: source ?? null,
    source_office: sourceOffice ?? null,
    source_contacts: sourceContacts.map((relation) => {
      const relationRow = relation as OpportunityWorkflowContactRow & {
        contact?:
          | OpportunityWorkflowContactRow["contact"]
          | OpportunityWorkflowContactRow["contact"][]
      }
      const contact = Array.isArray(relationRow.contact)
        ? relationRow.contact[0]
        : relationRow.contact
      return {
        ...relationRow,
        contact: contact
          ? {
              ...contact,
              name: relationRow.contact_name_snapshot ?? contact.name,
              email: relationRow.contact_email_snapshot ?? contact.email,
              phone: relationRow.contact_phone_snapshot ?? contact.phone,
            }
          : null,
      }
    }),
    office_contacts: officeContacts.map((relation) => {
      const relationRow = relation as OpportunityWorkflowCanonicalContactRow & {
        affiliation?:
          | OpportunityWorkflowCanonicalContactRow["affiliation"]
          | OpportunityWorkflowCanonicalContactRow["affiliation"][]
      }
      const affiliation = Array.isArray(relationRow.affiliation)
        ? relationRow.affiliation[0]
        : relationRow.affiliation
      const contact = Array.isArray(affiliation?.contact)
        ? affiliation.contact[0]
        : affiliation?.contact
      return {
        ...relationRow,
        affiliation: affiliation
          ? {
              ...affiliation,
              contact: contact ?? null,
            }
          : null,
      }
    }),
  } as OpportunityWorkflowRow
}

function getWorkflowContacts(
  opportunity: OpportunityWorkflowRow,
): MaWorkflowContact[] {
  const canonicalContacts: MaWorkflowContact[] = (opportunity.office_contacts ?? [])
    .filter((relation) => relation.is_active)
    .map((relation) => {
      return {
        id: relation.id,
        name:
          relation.contact_name_snapshot ??
          relation.affiliation?.contact?.display_name ??
          null,
        email:
          relation.contact_email_snapshot ??
          relation.affiliation?.contact?.email ??
          null,
        phone:
          relation.contact_phone_snapshot ??
          relation.affiliation?.contact?.phone ??
          null,
        isPrimary: relation.is_primary,
        legacySourceContactId: relation.legacy_source_contact_id,
      }
    })

  if (canonicalContacts.length > 0) {
    return canonicalContacts.sort(
      (left, right) => Number(right.isPrimary) - Number(left.isPrimary),
    )
  }

  const legacyContacts: Array<MaWorkflowContact | null> = (
    opportunity.source_contacts ?? []
  ).map((relation) => {
      const contact = relation.contact
      if (!contact) return null
      return {
        id: relation.contact_id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        isPrimary: relation.is_primary,
        legacySourceContactId: relation.contact_id,
      }
    })

  return legacyContacts
    .filter((contact): contact is MaWorkflowContact => contact !== null)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
}

function repreneurName(match: MatchRow | null) {
  const repreneur = match?.repreneur
  const name = [repreneur?.first_name, repreneur?.last_name]
    .filter(Boolean)
    .join(" ")
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
    compactLine(
      "Secteurs cibles",
      asList(repreneur.q13_target_sectors_v2).join(", "),
    ),
    compactLine(
      "Taille de deal ciblee",
      asList(repreneur.q14_deal_size).join(", "),
    ),
    compactLine("Apport personnel", repreneur.q16_equity),
  ].filter(Boolean)

  return lines.length > 0
    ? lines.join("\n")
    : "Profil repreneur a completer dans Re-New."
}

function bestMatch(matches: MatchRow[]) {
  const priority: OpportunityMatchStatus[] = [
    "active_pursuit",
    "interested",
    "proposed",
    "shortlisted",
    "draft",
  ]
  return (
    [...matches].sort((a, b) => {
      const priorityDiff =
        priority.indexOf(a.status) - priority.indexOf(b.status)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })[0] ?? null
  )
}

function activePursuit(matches: MatchRow[]) {
  return matches.find((match) => match.status === "active_pursuit") ?? null
}

function opportunityTitle(opportunity: OpportunityWorkflowRow) {
  return opportunity.public_title || opportunity.sector || opportunity.reference
}

function substituteTemplateVariables(
  value: string,
  variables: Record<string, string>,
) {
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match
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
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
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
  const sendPromise = resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html: markdownToEmailHtml(body),
    text: body,
  })

  const timeoutPromise = new Promise<{ error: { message: string } }>(
    (resolve) => {
      setTimeout(
        () => resolve({ error: { message: "Email provider timed out" } }),
        15000,
      )
    },
  )

  const { error } = await Promise.race([sendPromise, timeoutPromise])
  return error ? { success: false, error: error.message } : { success: true }
}

async function loadOpportunityContext(opportunityId: string) {
  const supabase = createAdminClient()
  const [
    { data: opportunityRow, error: opportunityError },
    { data: matchRows, error: matchError },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        `
        id,
        reference,
        status,
        public_title,
        sector,
        activity,
        location,
        date_added,
        created_at,
        updated_at,
        source_id,
        source_office_id,
        source_label,
        source:ma_sources(id, firm_name),
        source_contacts:opportunity_source_contacts(
          contact_id,
          is_primary,
          contact_name_snapshot,
          contact_email_snapshot,
          contact_phone_snapshot,
          contact:ma_source_contacts(id, name, email, phone)
        ),
        source_office:ma_offices(
          id,
          name,
          firm:ma_firms(id, name)
        ),
        office_contacts:opportunity_ma_contacts(
          id,
          affiliation_id,
          legacy_source_contact_id,
          is_primary,
          is_active,
          contact_name_snapshot,
          contact_email_snapshot,
          contact_phone_snapshot,
          affiliation:ma_contact_office_affiliations(
            id,
            office_id,
            contact:ma_contacts(id, display_name, email, phone)
          )
        )
      `,
      )
      .eq("id", opportunityId)
      .single(),
    supabase
      .from("opportunity_matches")
      .select(
        `
        id,
        status,
        pursuit_stage,
        pursuit_stage_updated_at,
        nda_status,
        nda_signed_at,
        nda_waived_at,
        nda_waived_by,
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
      `,
      )
      .eq("opportunity_id", opportunityId)
      .order("updated_at", { ascending: false }),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (matchError) throw new Error(matchError.message)

  const opportunity = normalizeSource(opportunityRow)
  const matches = ((matchRows ?? []) as MatchQueryRow[]).map((row) => ({
    ...row,
    repreneur: Array.isArray(row.repreneur)
      ? (row.repreneur[0] ?? null)
      : (row.repreneur ?? null),
  })) as MatchRow[]

  const match = bestMatch(matches)
  const activeMatch = activePursuit(matches)
  const profileMatch = activeMatch ?? match
  const contacts = getWorkflowContacts(opportunity)
  const defaultContact =
    contacts.find((contact) => contact.isPrimary) ?? contacts[0] ?? null
  const variables = {
    firstName: defaultContact?.name?.split(/\s+/)[0] || "Bonjour",
    firmName:
      opportunity.source_office?.firm?.name ||
      opportunity.source?.firm_name ||
      opportunity.source_label ||
      "votre cabinet",
    opportunityTitle: opportunityTitle(opportunity),
    repreneurName: repreneurName(profileMatch),
    repreneurProfile: formatRepreneurProfile(profileMatch),
    nextStep:
      match?.status === "active_pursuit"
        ? "un echange avec le vendeur"
        : "un premier echange de qualification",
    sector: opportunity.sector || "secteur non precise",
    location: opportunity.location || "localisation non precise",
  }

  return { opportunity, variables, activeMatch, contacts, defaultContact }
}

export async function getMaOpportunityWorkflow(
  opportunityId: string,
): Promise<MaOpportunityWorkflow> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { opportunity, variables, activeMatch, contacts, defaultContact } =
    await loadOpportunityContext(opportunityId)

  const drafts = await Promise.all(
    MA_TEMPLATE_KEYS.map(async (templateKey) => {
      const metadata = TEMPLATE_METADATA[templateKey]
      const subject = await getTemplateSubject(templateKey, metadata.name)
      const body =
        (await getTemplateBody(templateKey)) ||
        MA_TEMPLATE_DEFAULT_BODIES[templateKey] ||
        ""
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
  const interactions = (data ?? []) as MaSourceInteraction[]

  let memoAvailable = false
  if (activeMatch) {
    const { data: memoDocuments, error: memoDocumentsError } = await supabase
      .from("opportunity_documents")
      .select(
        "document_type, visibility, storage_path, external_url, repreneur_approved_at, repreneur_approved_by",
      )
      .eq("opportunity_id", opportunityId)
      .eq("document_type", "deal_book")
      .eq("visibility", "approved_for_repreneur")

    if (memoDocumentsError) throw new Error(memoDocumentsError.message)
    memoAvailable = (memoDocuments ?? []).some((document) =>
      canAccessOpportunityMemo(activeMatch, document),
    )
  }

  const recommendation = deriveMaWorkflowRecommendation({
    opportunity,
    activeMatch,
    interactions,
    memoAvailable,
  })

  return {
    contacts,
    recipientContactId: defaultContact?.id ?? null,
    recipientEmail: defaultContact?.email ?? null,
    sourceName:
      opportunity.source_office?.firm?.name ||
      opportunity.source?.firm_name ||
      opportunity.source_label ||
      "No source",
    contactName: defaultContact?.name ?? null,
    recommendedTemplateKey: recommendation?.templateKey ?? null,
    activePursuitName: activeMatch ? repreneurName(activeMatch) : null,
    stalledReminder: recommendation
      ? {
          title: recommendation.title,
          message: recommendation.message,
        }
      : null,
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
  const contactId = readString(formData, "contact_id")

  return sendMaSourceWorkflowEmailPayload(opportunityId, {
    templateKey,
    subject,
    body,
    contactId,
  })
}

export async function sendMaSourceWorkflowEmailPayload(
  opportunityId: string,
  payload: {
    templateKey: string | null
    subject: string | null
    body: string | null
    contactId?: string | null
  },
): Promise<{ success: boolean; message: string }> {
  const { user } = await requireStaffAccess()
  const { templateKey, subject, body, contactId } = payload

  if (!templateKey || !isMaTemplateKey(templateKey)) {
    return { success: false, message: "Choose an M&A email template." }
  }
  if (!subject) return { success: false, message: "Subject is required." }
  if (!body) return { success: false, message: "Message body is required." }

  const supabase = createAdminClient()
  const { data: sourceReviewRequired, error: sourceReviewError } =
    await supabase.rpc("ma_opportunity_source_review_required", {
      p_opportunity_id: opportunityId,
    })

  if (sourceReviewError || sourceReviewRequired !== false) {
    return {
      success: false,
      message: sourceReviewError
        ? "Email blocked because the source review status could not be verified."
        : "Email blocked until the provisional Acme source is reviewed and resolved.",
    }
  }

  const { data: emailReservationToken, error: emailReservationError } =
    await supabase.rpc("reserve_ma_source_email_send", {
      p_opportunity_id: opportunityId,
      p_actor: user.id,
    })

  if (emailReservationError || typeof emailReservationToken !== "string") {
    return {
      success: false,
      message:
        "Email blocked because the source context changed or another send is already in progress.",
    }
  }

  try {
    const { opportunity, variables, activeMatch, contacts, defaultContact } =
      await loadOpportunityContext(opportunityId)

    if (templateKey === "ma_nda_info_memo_request" && !activeMatch) {
      return {
        success: false,
        message:
          "Validate a repreneur pursuit before requesting the M&A firm's NDA/info memo.",
      }
    }

    if (
      !opportunity.source_office &&
      !opportunity.source_id &&
      !opportunity.source
    ) {
      return {
        success: false,
        message: "This opportunity is not linked to an M&A source yet.",
      }
    }
    const recipient = contactId
      ? (contacts.find((contact) => contact.id === contactId) ?? null)
      : defaultContact
    if (contactId && !recipient) {
      return {
        success: false,
        message: "Choose a contact linked to this opportunity.",
      }
    }
    if (!recipient) {
      return {
        success: false,
        message:
          "Link an M&A contact to this opportunity before sending a follow-up.",
      }
    }
    const recipientEmail = recipient.email
    if (!recipientEmail) {
      return {
        success: false,
        message:
          "Add an email to the selected M&A contact before sending a follow-up.",
      }
    }

    const renderedSubject = substituteTemplateVariables(subject, variables)
    const renderedBody = substituteTemplateVariables(body, variables)

    const {
      data: emailReservationRefreshed,
      error: emailReservationRefreshError,
    } = await supabase.rpc("refresh_ma_source_email_send", {
      p_opportunity_id: opportunityId,
      p_reservation_token: emailReservationToken,
    })

    if (emailReservationRefreshError || emailReservationRefreshed !== true) {
      return {
        success: false,
        message:
          "Email blocked because the source context changed before delivery.",
      }
    }

    const result = await sendIntermediaryEmail({
      to: recipientEmail,
      subject: renderedSubject,
      body: renderedBody,
    })

    const status = result.success ? "sent" : "failed"
    const { error } = await supabase.from("ma_source_interactions").insert({
      opportunity_id: opportunity.id,
      source_id: opportunity.source_id,
      contact_id: recipient.legacySourceContactId ?? null,
      template_key: templateKey,
      channel: "email",
      direction: "outbound",
      recipient_email: recipientEmail,
      subject: renderedSubject,
      body_markdown: renderedBody,
      status,
      error_message: result.success
        ? null
        : (result.error ?? "Email send failed"),
      sent_at: result.success ? new Date().toISOString() : null,
    })

    if (error) {
      return {
        success: false,
        message: result.success
          ? "Email sent, but the interaction could not be logged."
          : result.error ||
            "Email failed and the interaction could not be logged.",
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
  } finally {
    await supabase.rpc("release_ma_source_email_send", {
      p_opportunity_id: opportunityId,
      p_reservation_token: emailReservationToken,
    })
  }
}
