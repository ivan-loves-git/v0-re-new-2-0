"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveNewOpportunitySector } from "@/lib/utils/opportunity-sector"
import {
  isOpportunityClosureReason,
  isOpportunityStatus,
  type MaSource,
  type MaSourceType,
  type MaSource_Insert,
  type MaSource_Update,
  type Opportunity,
  type OpportunityActionResult,
  type OpportunityClosureHistoryEntry,
  type OpportunityStatus,
  type OpportunityVisibility,
  type Opportunity_Insert,
  type Opportunity_Update,
  type OpportunityWithSource,
  type OpportunityWorkSurfaceMatch,
  type OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"

type OpportunitySourceRow = Record<string, unknown> & {
  source?: MaSource | MaSource[] | null
}

type OpportunityWorkSurfaceMatchRow = Record<string, unknown> & {
  repreneur?: OpportunityWorkSurfaceMatch["repreneur"] | OpportunityWorkSurfaceMatch["repreneur"][] | null
}

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(formData: FormData, key: string): number | null {
  const value = readString(formData, key)
  if (!value) return null
  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/m€|meur|m€/gi, "")
    .replace(/k€|keur|k€/gi, "")
    .replace(/[€]/g, "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function readHeadcountApproximation(formData: FormData): number | null {
  const value = readString(formData, "headcount_range")
  if (!value) return null
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function readStatus(formData: FormData, fallback: OpportunityStatus = "draft"): OpportunityStatus {
  const value = readString(formData, "status")
  return isOpportunityStatus(value) ? value : fallback
}

function readVisibility(formData: FormData, key: string, fallback: OpportunityVisibility): OpportunityVisibility {
  return (readString(formData, key) as OpportunityVisibility | null) ?? fallback
}

function normalizeOpportunity(row: OpportunitySourceRow): OpportunityWithSource {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  return {
    ...row,
    source: source ?? null,
  } as OpportunityWithSource
}

function normalizeWorkSurfaceMatch(row: OpportunityWorkSurfaceMatchRow): OpportunityWorkSurfaceMatch {
  const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
  return {
    ...row,
    repreneur: repreneur ?? null,
  } as OpportunityWorkSurfaceMatch
}

function hasSourceFormData(formData: FormData) {
  return Boolean(
    readString(formData, "source_firm_name") ||
    readString(formData, "source_contact_name") ||
    readString(formData, "source_contact_email") ||
    readString(formData, "source_contact_phone") ||
    readString(formData, "source_internal_notes")
  )
}

function isValidEmail(email: string | null) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
}

function validateOpportunityForm(
  formData: FormData,
  sectorValue = readString(formData, "sector"),
  sectorFieldError?: { field: "sector_choice" | "sector_other"; message: string } | null,
): OpportunityActionResult | null {
  const fieldErrors: Record<string, string> = {}

  const requiredTextFields: Array<[string, string]> = [
    ["reference", "Ref. Mandat is required."],
    ["source_firm_name", "Source is required."],
    ["source_contact_name", "M&A contact name is required."],
    ["location", "Localisation is required."],
    ["description", "Description is required."],
    ["headcount_range", "Effectif is required."],
    ["date_added", "Date ajout is required."],
    ["teaser_summary", "Teaser summary is required."],
  ]

  for (const [field, message] of requiredTextFields) {
    if (!readString(formData, field)) fieldErrors[field] = message
  }

  if (sectorFieldError) {
    fieldErrors[sectorFieldError.field] = sectorFieldError.message
  } else if (!sectorValue) {
    fieldErrors.sector = "Secteur is required."
  }

  const sourceEmail = readString(formData, "source_contact_email")
  if (!sourceEmail) {
    fieldErrors.source_contact_email = "M&A contact email is required."
  } else if (!isValidEmail(sourceEmail)) {
    fieldErrors.source_contact_email = "M&A contact email must be valid."
  }

  const revenue = readNumber(formData, "revenue_meur")
  if (readString(formData, "revenue_meur") === null) {
    fieldErrors.revenue_meur = "CA M€ is required."
  } else if (revenue === null) {
    fieldErrors.revenue_meur = "CA M€ must be a number."
  }

  const ebitda = readNumber(formData, "ebitda_keur")
  if (readString(formData, "ebitda_keur") === null) {
    fieldErrors.ebitda_keur = "EBE K€ is required."
  } else if (ebitda === null) {
    fieldErrors.ebitda_keur = "EBE K€ must be a number."
  }

  if (Object.keys(fieldErrors).length === 0) return null

  return {
    success: false,
    message: "Complete the required Excel fields before saving.",
    fieldErrors,
  }
}

async function upsertSourceFromForm(formData: FormData, createdBy: string): Promise<string | null> {
  if (!hasSourceFormData(formData)) return null

  const supabase = createAdminClient()
  const sourceId = readString(formData, "source_id")
  const firmName = readString(formData, "source_firm_name") ?? "Unknown source"
  const sourceType = (readString(formData, "source_type") as MaSourceType | null) ?? "ma_firm"
  const payload: MaSource_Insert & MaSource_Update = {
    firm_name: firmName,
    source_type: sourceType,
    contact_name: readString(formData, "source_contact_name"),
    contact_email: readString(formData, "source_contact_email"),
    contact_phone: readString(formData, "source_contact_phone"),
    internal_notes: readString(formData, "source_internal_notes"),
  }

  if (sourceId) {
    const { error } = await supabase.from("ma_sources").update(payload).eq("id", sourceId)
    if (error) throw new Error(error.message)
    return sourceId
  }

  const { data, error } = await supabase
    .from("ma_sources")
    .insert({ ...payload, created_by: createdBy })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return (data as MaSource).id
}

function buildOpportunityPayload(
  formData: FormData,
  sourceId: string | null,
  sectorValue = readString(formData, "sector"),
  fallbackStatus: OpportunityStatus = "draft",
): Opportunity_Update {
  return {
    reference: readString(formData, "reference") ?? undefined,
    status: readStatus(formData, fallbackStatus),
    source_id: sourceId,
    source_label: readString(formData, "source_label") ?? readString(formData, "source_firm_name"),
    sector: sectorValue,
    activity: readString(formData, "activity"),
    location: readString(formData, "location"),
    description: readString(formData, "description"),
    revenue_meur: readNumber(formData, "revenue_meur"),
    ebitda_keur: readNumber(formData, "ebitda_keur"),
    headcount: readHeadcountApproximation(formData),
    headcount_range: readString(formData, "headcount_range"),
    date_added: readString(formData, "date_added"),
    repreneur_exposure: readVisibility(formData, "repreneur_exposure", "anonymized"),
    public_title: readString(formData, "public_title"),
    teaser_summary: readString(formData, "teaser_summary"),
    internal_notes: readString(formData, "internal_notes"),
  }
}

export async function listOpportunities(): Promise<OpportunityWithSource[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select("*, source:ma_sources(*)")
    .order("date_added", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeOpportunity)
}

export async function listOpportunityWorkSurfaceRecords(): Promise<OpportunityWorkSurfaceRecord[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select("*, source:ma_sources(*)")
    .order("date_added", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const opportunities = (data ?? []).map(normalizeOpportunity)
  const opportunityIds = opportunities.map((opportunity) => opportunity.id)

  if (opportunityIds.length === 0) {
    return opportunities.map((opportunity) => ({ ...opportunity, matches: [] }))
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      status,
      pursuit_stage,
      updated_at,
      repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)
    `)
    .in("opportunity_id", opportunityIds)
    .order("updated_at", { ascending: false })

  if (matchError) throw new Error(matchError.message)

  const matchesByOpportunity = new Map<string, OpportunityWorkSurfaceMatch[]>()
  for (const row of matchRows ?? []) {
    const match = normalizeWorkSurfaceMatch(row)
    const current = matchesByOpportunity.get(match.opportunity_id) ?? []
    current.push(match)
    matchesByOpportunity.set(match.opportunity_id, current)
  }

  return opportunities.map((opportunity) => ({
    ...opportunity,
    matches: matchesByOpportunity.get(opportunity.id) ?? [],
  }))
}

export async function getOpportunity(id: string): Promise<OpportunityWithSource | null> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select("*, source:ma_sources(*)")
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return normalizeOpportunity(data)
}

export async function getOpportunityClosureHistory(id: string): Promise<OpportunityClosureHistoryEntry[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_closure_history")
    .select("id, opportunity_id, reason, closed_by, closed_at")
    .eq("opportunity_id", id)
    .order("closed_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as OpportunityClosureHistoryEntry[]
}

export async function createOpportunity(formData: FormData) {
  const { user } = await requireStaffAccess()
  if (readStatus(formData) === "closed") {
    return {
      success: false,
      message: "Choose a closure reason from the opportunity detail before closing it.",
      fieldErrors: { status: "Use the dedicated closure control to close an opportunity." },
    } satisfies OpportunityActionResult
  }

  const sectorResolution = resolveNewOpportunitySector(
    formData.get("sector_choice"),
    formData.get("sector_other"),
  )
  const validation = validateOpportunityForm(
    formData,
    sectorResolution.value,
    sectorResolution.fieldError,
  )
  if (validation) return validation

  const reference = readString(formData, "reference")
  if (!reference) {
    return {
      success: false,
      message: "Ref. Mandat is required.",
      fieldErrors: { reference: "Ref. Mandat is required." },
    } satisfies OpportunityActionResult
  }

  const sourceId = await upsertSourceFromForm(formData, user.id)
  const payload: Opportunity_Insert = {
    ...(buildOpportunityPayload(formData, sourceId, sectorResolution.value) as Opportunity_Insert),
    reference,
    created_by: user.id,
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("opportunities").insert(payload).select().single()
  if (error) throw new Error(error.message)

  revalidatePath("/opportunities")
  revalidateOpportunityDashboardTags()
  redirect(`/opportunities/${(data as Opportunity).id}`)
}

export async function createOpportunityFromDraft(draft: Opportunity_Insert): Promise<Opportunity> {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      ...draft,
      repreneur_exposure: draft.repreneur_exposure ?? "anonymized",
      created_by: draft.created_by ?? user.id,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/opportunities")
  revalidateOpportunityDashboardTags()
  return data as Opportunity
}

export async function updateOpportunity(id: string, formData: FormData) {
  const { user } = await requireStaffAccess()
  const validation = validateOpportunityForm(formData)
  if (validation) return validation

  const reference = readString(formData, "reference")
  if (!reference) {
    return {
      success: false,
      message: "Ref. Mandat is required.",
      fieldErrors: { reference: "Ref. Mandat is required." },
    } satisfies OpportunityActionResult
  }

  const supabase = createAdminClient()
  const { data: existingOpportunity, error: existingOpportunityError } = await supabase
    .from("opportunities")
    .select("status")
    .eq("id", id)
    .maybeSingle()

  if (existingOpportunityError) throw new Error(existingOpportunityError.message)
  if (!existingOpportunity) {
    return {
      success: false,
      message: "Opportunity not found.",
    } satisfies OpportunityActionResult
  }

  const currentStatus = existingOpportunity.status as OpportunityStatus
  const requestedStatus = readStatus(formData, currentStatus)
  if (currentStatus !== "closed" && requestedStatus === "closed") {
    return {
      success: false,
      message: "Choose a closure reason from the opportunity detail before closing it.",
      fieldErrors: { status: "Use the dedicated closure control to close an opportunity." },
    } satisfies OpportunityActionResult
  }

  if (currentStatus === "closed" && requestedStatus !== "closed") {
    return {
      success: false,
      message: "Reopen this opportunity from its detail before changing its status.",
      fieldErrors: { status: "Use the dedicated reopen control to change a closed opportunity." },
    } satisfies OpportunityActionResult
  }

  const sourceId = await upsertSourceFromForm(formData, user.id)
  const payload = buildOpportunityPayload(formData, sourceId, undefined, currentStatus)

  const { error } = await supabase.from("opportunities").update(payload).eq("id", id)
  if (error) throw new Error(error.message)

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
  return { success: true, message: "Opportunity saved." } satisfies OpportunityActionResult
}

export async function closeOpportunity(id: string, reason: unknown): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  if (!isOpportunityClosureReason(reason)) {
    return {
      success: false,
      message: "Choose one closure reason before closing this opportunity.",
      fieldErrors: { closure_reason: "Choose a valid closure reason." },
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("close_opportunity_with_reason", {
    p_opportunity_id: id,
    p_reason: reason,
    p_closed_by: user.id,
  })

  if (error) {
    if (error.message.includes("opportunity_not_open_for_closure")) {
      return { success: false, message: "This opportunity is already closed." }
    }
    throw new Error(error.message)
  }

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
  return { success: true, message: "Opportunity closed. Its closure reason is retained in history." }
}

export async function reopenOpportunity(id: string): Promise<OpportunityActionResult> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .update({ status: "active" })
    .eq("id", id)
    .eq("status", "closed")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    return { success: false, message: "Only a closed opportunity can be reopened." }
  }

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
  return { success: true, message: "Opportunity reopened as active. Closure history is retained." }
}

export async function archiveOpportunity(id: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("opportunities")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
}
