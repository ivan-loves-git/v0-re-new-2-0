"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth-server"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MaSource,
  MaSourceType,
  MaSource_Insert,
  MaSource_Update,
  Opportunity,
  OpportunityStatus,
  OpportunityVisibility,
  Opportunity_Insert,
  Opportunity_Update,
  OpportunityWithSource,
  OpportunityWorkSurfaceMatch,
  OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(formData: FormData, key: string): number | null {
  const value = readString(formData, key)
  if (!value) return null
  const normalized = value.replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function readInteger(formData: FormData, key: string): number | null {
  const value = readNumber(formData, key)
  if (value === null) return null
  return Math.trunc(value)
}

function readStatus(formData: FormData): OpportunityStatus {
  return (readString(formData, "status") as OpportunityStatus | null) ?? "draft"
}

function readVisibility(formData: FormData, key: string, fallback: OpportunityVisibility): OpportunityVisibility {
  return (readString(formData, key) as OpportunityVisibility | null) ?? fallback
}

function normalizeOpportunity(row: any): OpportunityWithSource {
  const source = Array.isArray(row.source) ? row.source[0] : row.source
  return {
    ...row,
    source: source ?? null,
  } as OpportunityWithSource
}

function normalizeWorkSurfaceMatch(row: any): OpportunityWorkSurfaceMatch {
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
    readString(formData, "source_notes")
  )
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
    notes: readString(formData, "source_notes"),
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
    source_visibility: readVisibility(formData, "source_visibility", "staff_only"),
    sector: readString(formData, "sector"),
    activity: readString(formData, "activity"),
    location: readString(formData, "location"),
    description: readString(formData, "description"),
    revenue_meur: readNumber(formData, "revenue_meur"),
    ebitda_keur: readNumber(formData, "ebitda_keur"),
    headcount: readInteger(formData, "headcount"),
    date_added: readString(formData, "date_added"),
    repreneur_visibility: readVisibility(formData, "repreneur_visibility", "anonymized"),
    public_title: readString(formData, "public_title"),
    anonymized_description: readString(formData, "anonymized_description"),
    staff_notes: readString(formData, "staff_notes"),
  }
}

export async function listOpportunities(): Promise<OpportunityWithSource[]> {
  await requireUser()
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
  await requireUser()
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
  await requireUser()
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
  const user = await requireUser()
  const reference = readString(formData, "reference")
  if (!reference) throw new Error("Reference is required")

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
  const user = await requireUser()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      ...draft,
      source_visibility: draft.source_visibility ?? "staff_only",
      repreneur_visibility: draft.repreneur_visibility ?? "anonymized",
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
  const user = await requireUser()
  const reference = readString(formData, "reference")
  if (!reference) throw new Error("Reference is required")

  const sourceId = await upsertSourceFromForm(formData, user.id)
  const payload = buildOpportunityPayload(formData, sourceId)
  const supabase = createAdminClient()

  const { error } = await supabase.from("opportunities").update(payload).eq("id", id)
  if (error) throw new Error(error.message)

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
}

export async function archiveOpportunity(id: string) {
  await requireUser()
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
