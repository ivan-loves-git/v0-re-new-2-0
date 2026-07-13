"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MaSource,
  MaSourceType,
  MaSource_Insert,
  MaSource_Update,
  Opportunity,
  OpportunityActionResult,
  OpportunityStatus,
  OpportunityVisibility,
  Opportunity_Insert,
  Opportunity_Update,
  OpportunityWithSource,
  OpportunityWorkSurfaceMatch,
  OpportunityWorkSurfaceRecord,
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

function readStatus(formData: FormData): OpportunityStatus {
  return (readString(formData, "status") as OpportunityStatus | null) ?? "draft"
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

function validateOpportunityForm(formData: FormData): OpportunityActionResult | null {
  const fieldErrors: Record<string, string> = {}

  const requiredTextFields: Array<[string, string]> = [
    ["reference", "Ref. Mandat is required."],
    ["source_firm_name", "Source is required."],
    ["source_contact_name", "M&A contact name is required."],
    ["location", "Localisation is required."],
    ["sector", "Secteur is required."],
    ["description", "Description is required."],
    ["headcount_range", "Effectif is required."],
    ["date_added", "Date ajout is required."],
    ["teaser_summary", "Teaser summary is required."],
  ]

  for (const [field, message] of requiredTextFields) {
    if (!readString(formData, field)) fieldErrors[field] = message
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

function buildOpportunityPayload(formData: FormData, sourceId: string | null): Opportunity_Update {
  return {
    reference: readString(formData, "reference") ?? undefined,
    status: readStatus(formData),
    source_id: sourceId,
    source_label: readString(formData, "source_label") ?? readString(formData, "source_firm_name"),
    sector: readString(formData, "sector"),
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

export async function createOpportunity(formData: FormData) {
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

  const sourceId = await upsertSourceFromForm(formData, user.id)
  const payload: Opportunity_Insert = {
    ...(buildOpportunityPayload(formData, sourceId) as Opportunity_Insert),
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

  const sourceId = await upsertSourceFromForm(formData, user.id)
  const payload = buildOpportunityPayload(formData, sourceId)
  const supabase = createAdminClient()

  const { error } = await supabase.from("opportunities").update(payload).eq("id", id)
  if (error) throw new Error(error.message)

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
  return { success: true, message: "Opportunity saved." } satisfies OpportunityActionResult
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
