"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { appendConfirmedWaveAiOutcome } from "@/lib/ai/next-action-outcome"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isOpportunityStatus,
  type MaCanonicalContactOption,
  type MaOfficeIntakeContact,
  type MaOfficeIntakeOffice,
  type OpportunityGeographyOption,
  type Opportunity,
  type OpportunityActionResult,
  type OpportunityStatus,
} from "@/lib/types/opportunity"
import {
  readOpportunityHeadcount,
  readOpportunityNumber,
  readOpportunityFormString,
} from "@/lib/utils/opportunity-incomplete-data"
import { resolveNewOpportunitySector } from "@/lib/utils/opportunity-sector"
import { isFranceGeographyMandatesEnabled } from "@/lib/opportunity-geography-release"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const INTAKE_STATUSES = new Set<OpportunityStatus>([
  "draft",
  "active",
  "paused",
])

type IntakeOptionalFields = {
  /** Omitted on an existing record unless staff explicitly chooses a correction. */
  geography_node_id?: string
  sector: string | null
  location: string | null
  revenue_meur: number | null
  ebitda_keur: number | null
  headcount: number | null
  headcount_range: string | null
  /** Omitted for an unchanged month-only source date. */
  date_added?: string | null
  /** A staff confirmation, never a caller-supplied precision value. */
  date_added_confirm_day?: boolean
  public_title: string | null
  teaser_summary: string | null
  internal_notes: string | null
}

interface MaOfficeIntakeProjectionRow {
  office_id: string
  firm_id: string
  firm_name: string
  firm_status: "prospect" | "active"
  office_name: string
  office_label: string
  affiliation_id: string | null
  contact_id: string | null
  contact_name: string | null
  contact_email: string | null
  job_title: string | null
}

interface MaCanonicalContactProjectionRow {
  id: string
  display_name: string
  email: string | null
}

interface ParsedOpportunityIntake {
  reference: string | null
  status: OpportunityStatus
  sourceOfficeId: string | null
  affiliationIds: string[]
  primaryAffiliationId: string | null
  description: string | null
  optionalFields: IntakeOptionalFields
}

export interface CreateMaFirmOfficeContextResult {
  success: boolean
  message: string
  fieldErrors?: Record<string, string>
  office?: MaOfficeIntakeOffice
}

export interface CreateMaOfficeContactResult {
  success: boolean
  message: string
  fieldErrors?: Record<string, string>
  contact?: MaOfficeIntakeContact
}

export interface CreateMaOfficeForExistingFirmResult {
  success: boolean
  message: string
  fieldErrors?: Record<string, string>
  office?: MaOfficeIntakeOffice
}

const DB_ERROR_MESSAGES: Record<string, { field: string; message: string }> = {
  opportunity_reference_required: {
    field: "reference",
    message: "Ref. Mandat is required.",
  },
  opportunity_geography_required: {
    field: "geography_node_id",
    message: "Choose the canonical geography before creating an opportunity.",
  },
  opportunity_geography_not_found: {
    field: "geography_node_id",
    message: "Choose a current canonical geography.",
  },
  opportunity_activation_requires_source_office: {
    field: "source_office_id",
    message:
      "Choose an operating office before activating or pausing this opportunity.",
  },
  opportunity_source_office_not_found: {
    field: "source_office_id",
    message: "Choose an available operating office.",
  },
  opportunity_source_office_requires_real_office_selection: {
    field: "source_office_id",
    message: "Choose the real operating office for this firm.",
  },
  opportunity_activation_requires_active_source_office: {
    field: "source_office_id",
    message: "Choose an active operating office.",
  },
  opportunity_activation_requires_non_archived_source_firm: {
    field: "source_office_id",
    message: "Choose an operating office from an active M&A advisory firm.",
  },
  opportunity_source_firm_not_found: {
    field: "source_office_id",
    message: "The selected office no longer has a valid firm context.",
  },
  opportunity_source_office_firm_mismatch: {
    field: "source_office_id",
    message:
      "The selected operating office does not match this opportunity's source context.",
  },
  opportunity_activation_requires_description: {
    field: "description",
    message: "Add a description before activating or pausing this opportunity.",
  },
  opportunity_activation_requires_contact: {
    field: "affiliation_ids",
    message:
      "Select at least one office-affiliated contact before activating or pausing.",
  },
  opportunity_activation_requires_exactly_one_primary_contact: {
    field: "primary_affiliation_id",
    message: "Choose exactly one primary contact before activating or pausing.",
  },
  opportunity_activation_requires_usable_primary_email: {
    field: "primary_affiliation_id",
    message:
      "Choose or update a primary contact with a usable email before activating or pausing.",
  },
  opportunity_contact_requires_source_office: {
    field: "source_office_id",
    message: "Choose an operating office before selecting contacts.",
  },
  opportunity_contact_affiliation_not_active_for_source_office: {
    field: "affiliation_ids",
    message:
      "Every selected contact must have an active affiliation with the selected office.",
  },
  opportunity_active_contact_affiliation_must_be_active: {
    field: "affiliation_ids",
    message:
      "One selected contact is no longer active for this operating office.",
  },
  opportunity_primary_affiliation_must_be_selected: {
    field: "primary_affiliation_id",
    message: "Choose the primary contact from the selected contacts.",
  },
  opportunity_office_context_supports_draft_active_or_paused_only: {
    field: "status",
    message:
      "Use the dedicated closure controls for closed or archived opportunities.",
  },
  opportunity_office_context_cannot_change_historical_status: {
    field: "status",
    message:
      "Historical opportunity records cannot be changed through Opportunity Intake.",
  },
  ma_provisional_source_resolution_requires_real_office: {
    field: "source_office_id",
    message:
      "Choose the real operating office to replace the provisional source.",
  },
  ma_provisional_source_resolution_supports_draft_active_or_paused_only: {
    field: "status",
    message:
      "Closed and archived opportunities retain their source history and cannot be corrected here.",
  },
  ma_provisional_source_change_blocked_during_email_send: {
    field: "source_office_id",
    message:
      "A source email is being sent. Wait for it to finish, then try again.",
  },
  ma_provisional_source_resolution_requires_current_acme_source: {
    field: "source_office_id",
    message:
      "Source review state changed. Refresh this opportunity and try again.",
  },
  ma_provisional_source_resolution_requires_assignment_evidence: {
    field: "source_office_id",
    message:
      "Source review state changed. Refresh this opportunity and try again.",
  },
  opportunity_not_found: {
    field: "source_office_id",
    message:
      "This opportunity is no longer available. Refresh the page and try again.",
  },
}

function actionFailure(
  message: string,
  fieldErrors?: Record<string, string>,
): OpportunityActionResult {
  return { success: false, message, fieldErrors }
}

function normalizeDbError(error: { message?: string | null }) {
  const rawMessage = error.message ?? ""
  const code = Object.keys(DB_ERROR_MESSAGES).find((candidate) =>
    rawMessage.includes(candidate),
  )
  if (!code) {
    return actionFailure(
      "Opportunity could not be saved. Check the intake fields and try again.",
    )
  }

  const mapped = DB_ERROR_MESSAGES[code]
  return actionFailure(mapped.message, { [mapped.field]: mapped.message })
}

function readRawFormText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : null
}

function readUuid(formData: FormData, key: string) {
  const value = readOpportunityFormString(formData, key)
  if (!value) return { value: null, error: null }
  if (!UUID_PATTERN.test(value)) {
    return {
      value: null,
      error: `${key} must be a valid selection.`,
    }
  }
  return { value, error: null }
}

function readNormalizedFormStringEntries(formData: FormData, key: string) {
  const entries = formData.getAll(key)
  const values = entries
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())

  return {
    values,
    hasNonStringEntries: values.length !== entries.length,
    hasRepeatedEntries: entries.length > 1,
  }
}

function readUuidList(formData: FormData, key: string) {
  const values = formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)

  if (values.some((value) => !UUID_PATTERN.test(value))) {
    return {
      value: [],
      error: "Choose contacts from the selected operating office.",
    }
  }

  return { value: [...new Set(values)], error: null }
}

function parseOptionalSector(formData: FormData) {
  const choice = readOpportunityFormString(formData, "sector_choice")
  if (!choice) return { value: null, fieldError: null }

  const resolution = resolveNewOpportunitySector(
    choice,
    formData.get("sector_other"),
  )
  return { value: resolution.value, fieldError: resolution.fieldError }
}

function parseOptionalNumber(formData: FormData, key: string) {
  const raw = readOpportunityFormString(formData, key)
  if (!raw) return { value: null, error: null }
  const value = readOpportunityNumber(formData, key)
  if (value === null) {
    return { value: null, error: `${key} must be a number.` }
  }
  return { value, error: null }
}

function parseOpportunityIntake(
  formData: FormData,
  options?: {
    requirePublicTitle?: boolean
    requireReference?: boolean
    requireGeography?: boolean
  },
): ParsedOpportunityIntake | OpportunityActionResult {
  const reference = readOpportunityFormString(formData, "reference")
  const rawStatus = readOpportunityFormString(formData, "status") ?? "draft"
  const status = isOpportunityStatus(rawStatus) ? rawStatus : null
  const sourceOffice = readUuid(formData, "source_office_id")
  const affiliations = readUuidList(formData, "affiliation_ids")
  const primaryAffiliation = readUuid(formData, "primary_affiliation_id")
  const sector = parseOptionalSector(formData)
  const revenue = parseOptionalNumber(formData, "revenue_meur")
  const ebitda = parseOptionalNumber(formData, "ebitda_keur")
  const geographyNodeId = readOpportunityFormString(formData, "geography_node_id")
  const fieldErrors: Record<string, string> = {}

  if (options?.requireReference && !reference) fieldErrors.reference = "Ref. Mandat is required."
  if (options?.requireGeography && !geographyNodeId) {
    fieldErrors.geography_node_id =
      "Choose the canonical geography before creating an opportunity."
  }
  if (
    options?.requirePublicTitle &&
    !readOpportunityFormString(formData, "public_title")
  ) {
    fieldErrors.public_title =
      "A safe public title is required for a new opportunity."
  }
  if (!status || !INTAKE_STATUSES.has(status)) {
    fieldErrors.status = "Choose Draft, Active, or Paused."
  }
  if (sourceOffice.error) fieldErrors.source_office_id = sourceOffice.error
  if (affiliations.error) fieldErrors.affiliation_ids = affiliations.error
  if (primaryAffiliation.error) {
    fieldErrors.primary_affiliation_id = primaryAffiliation.error
  }
  if (sector.fieldError) {
    fieldErrors[sector.fieldError.field] = sector.fieldError.message
  }
  if (revenue.error) fieldErrors.revenue_meur = "CA M€ must be a number."
  if (ebitda.error) fieldErrors.ebitda_keur = "EBE K€ must be a number."

  const dateAdded = readOpportunityFormString(formData, "date_added")
  const dateAddedConfirmedDay =
    readOpportunityFormString(formData, "date_added_confirm_day") === "on"
  const dateAddedClearRequested =
    readOpportunityFormString(formData, "date_added_clear") === "on"
  const dateAddedPreserveMonth =
    readOpportunityFormString(formData, "date_added_preserve_month") === "true"
  if (dateAdded && Number.isNaN(Date.parse(`${dateAdded}T00:00:00Z`))) {
    fieldErrors.date_added = "Date ajout must be a valid date."
  }
  if (dateAddedConfirmedDay && dateAddedClearRequested) {
    fieldErrors.date_added =
      "Choose either an exact calendar day or clear this source date."
  }
  if (dateAddedPreserveMonth && dateAddedConfirmedDay && !dateAdded) {
    fieldErrors.date_added =
      "Enter the verified exact calendar day before confirming it."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return actionFailure("Check the highlighted intake fields.", fieldErrors)
  }

  const dateFields: Pick<
    IntakeOptionalFields,
    "date_added" | "date_added_confirm_day"
  > = dateAddedPreserveMonth
    ? dateAddedClearRequested
      ? { date_added: null }
      : dateAddedConfirmedDay
        ? { date_added: dateAdded, date_added_confirm_day: true }
        : {}
    : {
        date_added: dateAdded,
        ...(dateAddedConfirmedDay ? { date_added_confirm_day: true } : {}),
      }

  return {
    reference: reference!,
    status: status!,
    sourceOfficeId: sourceOffice.value,
    affiliationIds: affiliations.value,
    primaryAffiliationId: primaryAffiliation.value,
    description: readRawFormText(formData, "description"),
    optionalFields: {
      ...(geographyNodeId ? { geography_node_id: geographyNodeId } : {}),
      sector: sector.value,
      location: readOpportunityFormString(formData, "location"),
      revenue_meur: revenue.value,
      ebitda_keur: ebitda.value,
      headcount: readOpportunityHeadcount(formData),
      headcount_range: readOpportunityFormString(formData, "headcount_range"),
      ...dateFields,
      public_title: readOpportunityFormString(formData, "public_title"),
      teaser_summary: readOpportunityFormString(formData, "teaser_summary"),
      internal_notes: readOpportunityFormString(formData, "internal_notes"),
    },
  }
}

/** France-first matching identities are staff-only; no office or location inference is allowed. */
export async function listOpportunityGeographyOptions(): Promise<OpportunityGeographyOption[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("geography_nodes")
    .select("id, stable_key, code, label, node_level, parent_id")
    .order("node_level")
    .order("label")
  if (error) throw new Error(error.message)
  return (data ?? []) as OpportunityGeographyOption[]
}

function isActionFailure(
  result: ParsedOpportunityIntake | OpportunityActionResult,
): result is OpportunityActionResult {
  return "success" in result
}

function revalidateOpportunityIntake(id?: string) {
  revalidatePath("/opportunities")
  revalidatePath("/opportunities/find")
  if (id) revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
}

export async function listMaOfficeIntakeOptions(options?: {
  includeCurrentProvisionalOfficeId?: string | null
}): Promise<MaOfficeIntakeOffice[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const [projectionResult, provisionalContextResult] = await Promise.all([
    supabase
      .from("staff_ma_office_intake_projection")
      .select(
        "office_id, firm_id, firm_name, firm_status, office_name, office_label, affiliation_id, contact_id, contact_name, contact_email, job_title",
      )
      .order("firm_name")
      .order("office_name")
      .order("contact_name", { nullsFirst: false }),
    supabase
      .from("ma_provisional_source_contexts")
      .select("office_id")
      .eq("context_key", "acme_co_paris")
      .maybeSingle(),
  ])

  if (projectionResult.error) throw new Error(projectionResult.error.message)
  if (provisionalContextResult.error) {
    throw new Error(provisionalContextResult.error.message)
  }
  const provisionalOfficeId = provisionalContextResult.data?.office_id ?? null
  const mayIncludeCurrentProvisionalOffice =
    Boolean(provisionalOfficeId) &&
    options?.includeCurrentProvisionalOfficeId === provisionalOfficeId

  const offices = new Map<string, MaOfficeIntakeOffice>()
  for (const row of (projectionResult.data ??
    []) as MaOfficeIntakeProjectionRow[]) {
    // Acme may only be assigned through the audited W-064 assignment action.
    // Hiding it here prevents ordinary intake from offering a path that the
    // deferred database invariant will reject anyway.
    if (row.office_id === provisionalOfficeId && !mayIncludeCurrentProvisionalOffice) continue
    const office = offices.get(row.office_id) ?? {
      office_id: row.office_id,
      firm_id: row.firm_id,
      firm_name: row.firm_name,
      firm_status: row.firm_status,
      office_name: row.office_name,
      office_label: row.office_label,
      contacts: [],
    }

    if (row.affiliation_id && row.contact_id) {
      const contact: MaOfficeIntakeContact = {
        affiliation_id: row.affiliation_id,
        contact_id: row.contact_id,
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        job_title: row.job_title,
      }
      office.contacts.push(contact)
    }
    offices.set(row.office_id, office)
  }

  return [...offices.values()]
}

/**
 * Staff-only canonical identities available to affiliate with another office.
 * This deliberately returns people, never an existing affiliation or any
 * repreneur-facing data.
 */
export async function listMaCanonicalContactOptions(): Promise<
  MaCanonicalContactOption[]
> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ma_contacts")
    .select("id, display_name, email")
    .eq("status", "active")
    .order("display_name")

  if (error) throw new Error(error.message)

  return ((data ?? []) as MaCanonicalContactProjectionRow[]).map((contact) => ({
    contact_id: contact.id,
    contact_name: contact.display_name,
    contact_email: contact.email,
  }))
}

export async function createOpportunityIntake(
  formData: FormData,
): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  const parsed = parseOpportunityIntake(formData, {
    requirePublicTitle: true,
    requireReference: !isFranceGeographyMandatesEnabled(),
    requireGeography: isFranceGeographyMandatesEnabled(),
  })
  if (isActionFailure(parsed)) return parsed

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "create_opportunity_with_office_context",
    {
      p_reference: parsed.reference,
      p_source_office_id: parsed.sourceOfficeId,
      p_affiliation_ids: parsed.affiliationIds,
      p_primary_affiliation_id: parsed.primaryAffiliationId,
      p_description: parsed.description,
      p_target_status: parsed.status,
      p_actor: user.id,
      p_opportunity_fields: parsed.optionalFields,
    },
  )

  if (error) {
    return normalizeDbError(error)
  }

  const opportunity = data as Opportunity
  if (!opportunity?.id || !opportunity.reference) {
    return actionFailure(
      "Opportunity was saved but its confirmation could not be read. Refresh the opportunity list before retrying.",
    )
  }
  revalidateOpportunityIntake(opportunity.id)
  return {
    success: true,
    message: `Opportunity ${opportunity.reference} created.`,
    opportunityId: opportunity.id,
    opportunityReference: opportunity.reference,
  }
}

export async function updateOpportunityIntake(
  opportunityId: string,
  formData: FormData,
): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  const parsed = parseOpportunityIntake(formData, { requireReference: true })
  if (isActionFailure(parsed)) return parsed

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("save_opportunity_office_context", {
    p_opportunity_id: opportunityId,
    p_source_office_id: parsed.sourceOfficeId,
    p_affiliation_ids: parsed.affiliationIds,
    p_primary_affiliation_id: parsed.primaryAffiliationId,
    p_description: parsed.description,
    p_target_status: parsed.status,
    p_actor: user.id,
    p_opportunity_fields: parsed.optionalFields,
  })

  if (error) return normalizeDbError(error)

  revalidateOpportunityIntake(opportunityId)
  await appendConfirmedWaveAiOutcome({
    token: readOpportunityFormString(formData, "wave_ai_outcome"),
    userId: user.id,
    opportunityId,
    action: "complete_opportunity_profile",
  })
  return { success: true, message: "Opportunity saved." }
}

/** Staff-only W-065 correction through the immutable W-064 resolver. */
export async function resolveAcmeProvisionalSource(
  opportunityId: string,
  formData: FormData,
): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  if (!UUID_PATTERN.test(opportunityId)) {
    return actionFailure(
      "This opportunity is no longer available for source review.",
    )
  }

  const sourceOffice = readUuid(formData, "source_office_id")
  const affiliations = readUuidList(formData, "affiliation_ids")
  const primaryAffiliation = readUuid(formData, "primary_affiliation_id")
  const reason = readOpportunityFormString(formData, "source_review_reason")
  const fieldErrors: Record<string, string> = {}
  if (!sourceOffice.value || sourceOffice.error) {
    fieldErrors.source_office_id =
      sourceOffice.error ?? "Choose the real operating office."
  }
  if (affiliations.error || affiliations.value.length === 0) {
    fieldErrors.affiliation_ids =
      affiliations.error ?? "Select at least one contact at the real office."
  }
  if (!primaryAffiliation.value || primaryAffiliation.error) {
    fieldErrors.primary_affiliation_id =
      primaryAffiliation.error ?? "Choose one primary contact."
  }
  if (!reason) {
    fieldErrors.source_review_reason = "Record why this is the verified source."
  } else if (reason.length > 4096) {
    fieldErrors.source_review_reason =
      "Keep the correction reason under 4,096 characters."
  }
  if (Object.keys(fieldErrors).length > 0) {
    return actionFailure("Complete the source correction details.", fieldErrors)
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("resolve_acme_provisional_source", {
    p_opportunity_id: opportunityId,
    p_replacement_office_id: sourceOffice.value,
    p_affiliation_ids: affiliations.value,
    p_primary_affiliation_id: primaryAffiliation.value,
    p_actor: user.id,
    p_reason: reason,
  })
  if (error) return normalizeDbError(error)

  revalidateOpportunityIntake(opportunityId)
  await appendConfirmedWaveAiOutcome({
    token: readOpportunityFormString(formData, "wave_ai_outcome"),
    userId: user.id,
    opportunityId,
    action: "resolve_source_review",
  })
  return {
    success: true,
    message:
      "Source corrected. The provisional assignment and this correction are retained in staff-only evidence.",
  }
}

export async function createMaFirmOfficeContext(
  formData: FormData,
): Promise<CreateMaFirmOfficeContextResult> {
  const { user } = await requireStaffAccess()
  const firmName = readOpportunityFormString(formData, "firm_name")
  const firstName = readOpportunityFormString(formData, "contact_first_name")
  const lastName = readOpportunityFormString(formData, "contact_last_name")
  const officeName = readOpportunityFormString(formData, "office_name")
  const email = readOpportunityFormString(formData, "contact_email")
  const phone = readOpportunityFormString(formData, "contact_phone")
  const jobTitle = readOpportunityFormString(formData, "contact_job_title")

  if (!firmName) {
    return {
      success: false,
      message: "M&A advisory firm name is required.",
      fieldErrors: { firm_name: "Enter the M&A advisory firm name." },
    }
  }
  if (!firstName && !lastName) {
    const message = "Add a first name or last name for the first contact."
    return {
      success: false,
      message,
      fieldErrors: { contact_first_name: message, contact_last_name: message },
    }
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: "Contact email must be valid.",
      fieldErrors: { contact_email: "Enter a valid email address, or leave it blank." },
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "create_ma_firm_with_default_office",
    {
      p_firm_name: firmName,
      p_contact_first_name: firstName,
      p_contact_last_name: lastName,
      p_office_name: officeName,
      p_is_synthetic_default: officeName ? false : true,
      p_contact_email: email,
      p_contact_phone: phone,
      p_contact_job_title: jobTitle,
      p_actor: user.id,
    },
  )

  if (error) {
    if (error.message?.includes("ma_firm_name_already_exists")) {
      const message = "This firm already exists; select its operating office."
      return {
        success: false,
        message,
        fieldErrors: { firm_name: message },
      }
    }

    return {
      success: false,
      message:
        "The M&A office context could not be created. Check the supplied details.",
    }
  }

  const identity = Array.isArray(data) ? data[0] : data
  if (
    !identity?.office_id ||
    !identity?.affiliation_id ||
    !identity?.contact_id
  ) {
    return {
      success: false,
      message:
        "The M&A office context was not returned by the approved service.",
    }
  }

  const contactName = [firstName, lastName].filter(Boolean).join(" ") || null
  const resolvedOfficeName = officeName ?? firmName
  const office: MaOfficeIntakeOffice = {
    office_id: identity.office_id as string,
    firm_id: identity.firm_id as string,
    firm_name: firmName,
    firm_status: "prospect",
    office_name: resolvedOfficeName,
    office_label:
      resolvedOfficeName.trim() === firmName.trim()
        ? firmName
        : `${firmName} — ${resolvedOfficeName}`,
    contacts: [
      {
        affiliation_id: identity.affiliation_id as string,
        contact_id: identity.contact_id as string,
        contact_name: contactName,
        contact_email: email,
        job_title: jobTitle,
      },
    ],
  }

  return {
    success: true,
    message: "M&A firm, operating office, and first contact created.",
    office,
  }
}

/**
 * Adds one real operating office to an existing active firm. This never
 * creates a fallback office or a contact: those are separate, explicit staff
 * actions so a partial source context cannot silently become valid.
 */
export async function createMaOfficeForExistingFirm(
  formData: FormData,
): Promise<CreateMaOfficeForExistingFirmResult> {
  const { user } = await requireStaffAccess()
  const firmId = readUuid(formData, "existing_firm_id")
  const officeName = readOpportunityFormString(formData, "office_name")
  const fieldErrors: Record<string, string> = {}

  if (!firmId.value || firmId.error) {
    fieldErrors.existing_firm_id =
      firmId.error ?? "Choose an active M&A advisory firm."
  }
  if (!officeName) {
    fieldErrors.office_name = "A real operating office name is required."
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Complete the operating office details.",
      fieldErrors,
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "create_ma_office_for_existing_firm",
    {
      p_firm_id: firmId.value,
      p_office_name: officeName,
      p_actor: user.id,
    },
  )

  if (error) {
    const message = error.message?.includes("ma_existing_firm_not_active")
      ? "This firm is no longer active. Refresh and choose another firm."
      : error.message?.includes("ma_existing_firm_not_found")
        ? "This firm is no longer available. Refresh and choose another firm."
        : error.message?.includes("ma_real_office_name_already_exists")
          ? "This firm already has an active real office with that name."
          : "The operating office could not be created. Check the supplied details."
    const field = error.message?.includes("office")
      ? "office_name"
      : "existing_firm_id"
    return { success: false, message, fieldErrors: { [field]: message } }
  }

  const identity = Array.isArray(data) ? data[0] : data
  if (
    !identity?.office_id ||
    !identity?.firm_id ||
    !identity?.firm_name ||
    !identity?.office_name
  ) {
    return {
      success: false,
      message:
        "The operating office was created but its confirmation could not be read. Refresh the page before retrying.",
    }
  }

  const resolvedOfficeName = identity.office_name as string
  const firmName = identity.firm_name as string
  const office: MaOfficeIntakeOffice = {
    office_id: identity.office_id as string,
    firm_id: identity.firm_id as string,
    firm_name: firmName,
    firm_status: "active",
    office_name: resolvedOfficeName,
    office_label:
      resolvedOfficeName.trim() === firmName.trim()
        ? firmName
        : `${firmName} — ${resolvedOfficeName}`,
    contacts: [],
  }

  return {
    success: true,
    message: "Operating office added to the existing firm.",
    office,
  }
}

/**
 * Adds one further person through the canonical office-affiliation primitive.
 * It deliberately has no legacy source-contact fallback: the selected office
 * remains the only relationship anchor.
 */
export async function createMaOfficeContact(
  officeId: string,
  formData: FormData,
): Promise<CreateMaOfficeContactResult> {
  const { user } = await requireStaffAccess()

  if (!UUID_PATTERN.test(officeId)) {
    return {
      success: false,
      message: "Choose a valid operating office before adding a contact.",
    }
  }

  const jobTitle = readOpportunityFormString(formData, "contact_job_title")
  const contactMode =
    readOpportunityFormString(formData, "contact_mode") ?? "new"
  const usesExistingContact = contactMode === "existing"

  if (!usesExistingContact && contactMode !== "new") {
    return {
      success: false,
      message:
        "Choose whether to affiliate an existing contact or create a new one.",
    }
  }

  const existingContactEntries = readNormalizedFormStringEntries(
    formData,
    "existing_contact_id",
  )
  const existingContact = existingContactEntries.values[0] ?? null

  if (
    !usesExistingContact &&
    (existingContactEntries.hasNonStringEntries ||
      existingContactEntries.values.some(Boolean))
  ) {
    return {
      success: false,
      message:
        "Choose either an existing canonical contact or a new contact, not both.",
    }
  }

  const firstName = usesExistingContact
    ? null
    : readOpportunityFormString(formData, "contact_first_name")
  const lastName = usesExistingContact
    ? null
    : readOpportunityFormString(formData, "contact_last_name")
  const email = usesExistingContact
    ? null
    : readOpportunityFormString(formData, "contact_email")
  const phone = usesExistingContact
    ? null
    : readOpportunityFormString(formData, "contact_phone")

  if (usesExistingContact) {
    if (
      existingContactEntries.hasNonStringEntries ||
      existingContactEntries.hasRepeatedEntries ||
      !existingContact ||
      !UUID_PATTERN.test(existingContact)
    ) {
      return {
        success: false,
        message:
          "Choose an active canonical contact to affiliate with this office.",
        fieldErrors: {
          existing_contact_id: "Choose an active canonical contact.",
        },
      }
    }

    if (
      [
        "contact_first_name",
        "contact_last_name",
        "contact_email",
        "contact_phone",
      ].some((field) => {
        const entries = readNormalizedFormStringEntries(formData, field)
        return (
          entries.hasNonStringEntries ||
          entries.hasRepeatedEntries ||
          entries.values.some(Boolean)
        )
      })
    ) {
      return {
        success: false,
        message:
          "Existing canonical contacts cannot be submitted with new identity details.",
      }
    }
  } else {
    if (!firstName && !lastName) {
      const message = "Add a first name or last name for the contact."
      return {
        success: false,
        message,
        fieldErrors: { contact_first_name: message, contact_last_name: message },
      }
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        message: "Contact email must be valid.",
        fieldErrors: { contact_email: "Enter a valid email address, or leave it blank." },
      }
    }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    "create_or_affiliate_ma_contact",
    usesExistingContact
      ? {
          p_office_id: officeId,
          p_existing_contact_id: existingContact,
          p_contact_job_title: jobTitle,
          p_actor: user.id,
        }
      : {
          p_office_id: officeId,
          p_existing_contact_id: null,
          p_contact_first_name: firstName,
          p_contact_last_name: lastName,
          p_contact_email: email,
          p_contact_phone: phone,
          p_contact_job_title: jobTitle,
          p_actor: user.id,
        },
  )

  if (error) {
    if (
      error.message?.includes("ma_contact_office_affiliation_already_active")
    ) {
      return {
        success: false,
        message:
          "This canonical contact is already affiliated with the selected office.",
      }
    }
    if (
      error.message?.includes("ma_contact_not_found") ||
      error.message?.includes("ma_contact_affiliation_requires_active_contact")
    ) {
      return {
        success: false,
        message:
          "The selected canonical contact is no longer active. Refresh and choose another contact.",
      }
    }
    return {
      success: false,
      message:
        "The office contact could not be added. Check the office and supplied details.",
    }
  }

  const identity = Array.isArray(data) ? data[0] : data
  if (!identity?.affiliation_id || !identity?.contact_id) {
    return {
      success: false,
      message: "The office contact was not returned by the approved service.",
    }
  }

  revalidateOpportunityIntake()
  return {
    success: true,
    message: "Office contact added.",
    contact: {
      affiliation_id: identity.affiliation_id as string,
      contact_id: identity.contact_id as string,
      contact_name: usesExistingContact
        ? null
        : [firstName, lastName].filter(Boolean).join(" ") || null,
      contact_email: usesExistingContact ? null : email,
      job_title: jobTitle,
    },
  }
}
