"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MaSource,
  MaSourceDirectoryEntry,
  MaSourceType,
  MaSource_Insert,
  MaSource_Update,
  OpportunityStatus,
} from "@/lib/types/opportunity"

interface SourceOpportunityRow {
  source_id: string | null
  reference: string
  public_title: string | null
  status: OpportunityStatus
  date_added: string | null
  created_at: string
}

const OPEN_STATUSES = new Set<OpportunityStatus>(["draft", "active", "paused"])
const SOURCE_TYPES = new Set<MaSourceType>(["ma_firm", "broker", "direct", "other"])
const STALE_DAYS = 90

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readSourceType(formData: FormData): MaSourceType {
  const value = readString(formData, "source_type") as MaSourceType | null
  return value && SOURCE_TYPES.has(value) ? value : "ma_firm"
}

function parseSourcePayload(formData: FormData): MaSource_Insert & MaSource_Update {
  const firmName = readString(formData, "firm_name")
  if (!firmName) throw new Error("Firm name is required")

  const contactEmail = readString(formData, "contact_email")
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Contact email is not valid")
  }

  return {
    firm_name: firmName,
    source_type: readSourceType(formData),
    contact_name: readString(formData, "contact_name"),
    contact_email: contactEmail,
    contact_phone: readString(formData, "contact_phone"),
    notes: readString(formData, "notes"),
  }
}

function getAgeDays(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)))
}

function latestDate(row: SourceOpportunityRow) {
  return row.date_added ?? row.created_at
}

function compareLatest(a: SourceOpportunityRow, b: SourceOpportunityRow) {
  return new Date(latestDate(b)).getTime() - new Date(latestDate(a)).getTime()
}

function revalidateMaSourceSurfaces() {
  revalidatePath("/opportunities/ma")
  revalidatePath("/opportunities/find")
  revalidatePath("/opportunities/groups")
  revalidatePath("/dashboard_op")
  revalidatePath("/opportunities")
  revalidateOpportunityDashboardTags()
}

export async function listMaSourceDirectory(): Promise<MaSourceDirectoryEntry[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [{ data: sources, error: sourcesError }, { data: opportunities, error: opportunitiesError }] =
    await Promise.all([
      supabase.from("ma_sources").select("*").order("firm_name"),
      supabase
        .from("opportunities")
        .select("source_id, reference, public_title, status, date_added, created_at")
        .not("source_id", "is", null),
    ])

  if (sourcesError) throw new Error(sourcesError.message)
  if (opportunitiesError) throw new Error(opportunitiesError.message)

  const opportunitiesBySource = new Map<string, SourceOpportunityRow[]>()
  for (const opportunity of (opportunities ?? []) as SourceOpportunityRow[]) {
    if (!opportunity.source_id) continue
    const current = opportunitiesBySource.get(opportunity.source_id) ?? []
    current.push(opportunity)
    opportunitiesBySource.set(opportunity.source_id, current)
  }

  return ((sources ?? []) as MaSource[]).map((source) => {
    const linkedOpportunities = opportunitiesBySource.get(source.id) ?? []
    const openOpportunities = linkedOpportunities.filter((opportunity) => OPEN_STATUSES.has(opportunity.status))
    const staleOpportunityCount = openOpportunities.filter((opportunity) => {
      const ageDays = getAgeDays(opportunity.date_added ?? opportunity.created_at)
      return ageDays !== null && ageDays > STALE_DAYS
    }).length
    const latestOpportunity = [...linkedOpportunities].sort(compareLatest)[0]

    return {
      ...source,
      opportunity_count: linkedOpportunities.length,
      open_opportunity_count: openOpportunities.length,
      stale_opportunity_count: staleOpportunityCount,
      latest_opportunity_date: latestOpportunity ? latestDate(latestOpportunity) : null,
      latest_opportunity_title: latestOpportunity?.public_title ?? latestOpportunity?.reference ?? null,
    }
  })
}

export async function createMaSource(formData: FormData): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()

  try {
    const payload = parseSourcePayload(formData)
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("ma_sources")
      .insert({ ...payload, created_by: access.user.id })

    if (error) throw new Error(error.message)

    revalidateMaSourceSurfaces()
    return { success: true, message: "M&A source created" }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create M&A source",
    }
  }
}

export async function updateMaSource(
  sourceId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  await requireStaffAccess()

  try {
    const payload = parseSourcePayload(formData)
    const supabase = createAdminClient()
    const { error } = await supabase.from("ma_sources").update(payload).eq("id", sourceId)

    if (error) throw new Error(error.message)

    revalidateMaSourceSurfaces()
    return { success: true, message: "M&A source updated" }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update M&A source",
    }
  }
}
