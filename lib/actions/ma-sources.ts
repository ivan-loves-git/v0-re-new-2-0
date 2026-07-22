"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MaSource,
  MaSourceContactDirectoryEntry,
  MaSourceContactMove,
  MaSourceContact_Update,
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
const SOURCE_TYPES = new Set<MaSourceType>([
  "ma_firm",
  "broker",
  "direct",
  "other",
])
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

function parseSourcePayload(
  formData: FormData,
): MaSource_Insert & MaSource_Update {
  const firmName = readString(formData, "firm_name")
  if (!firmName) throw new Error("Firm name is required")

  return {
    firm_name: firmName,
    source_type: readSourceType(formData),
    internal_notes: readString(formData, "internal_notes"),
  }
}

function parseContactPayload(formData: FormData): MaSourceContact_Update {
  const name = readString(formData, "contact_name")
  const contactEmail = readString(formData, "contact_email")
  const phone = readString(formData, "contact_phone")

  if (!name && !contactEmail && !phone) {
    throw new Error("Add at least one contact detail")
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Contact email is not valid")
  }

  return {
    name,
    email: contactEmail,
    phone,
  }
}

function getAgeDays(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)),
  )
}

function latestDate(row: SourceOpportunityRow) {
  return row.date_added ?? row.created_at
}

function compareLatest(a: SourceOpportunityRow, b: SourceOpportunityRow) {
  return new Date(latestDate(b)).getTime() - new Date(latestDate(a)).getTime()
}

function revalidateMaSourceSurfaces() {
  revalidatePath("/opportunities/ma")
  revalidatePath("/opportunities/ma/firms")
  revalidatePath("/opportunities/ma/contacts")
  revalidatePath("/opportunities/find")
  revalidatePath("/opportunities/groups")
  revalidatePath("/dashboard_op")
  revalidatePath("/opportunities")
  revalidateOpportunityDashboardTags()
}

async function resolveNetworkId(
  supabase: ReturnType<typeof createAdminClient>,
  formData: FormData,
  createdBy: string,
) {
  const networkName = readString(formData, "network_name")
  if (!networkName) return null

  const { data: existing, error: existingError } = await supabase
    .from("ma_source_networks")
    .select("id")
    .ilike("name", networkName)
    .limit(1)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing?.id) return existing.id as string

  const { data: created, error: createError } = await supabase
    .from("ma_source_networks")
    .insert({ name: networkName, created_by: createdBy })
    .select("id")
    .single()

  if (createError) throw new Error(createError.message)
  return created.id as string
}

export async function listMaSourceDirectory(): Promise<
  MaSourceDirectoryEntry[]
> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [
    { data: sources, error: sourcesError },
    { data: contacts, error: contactsError },
    { data: opportunities, error: opportunitiesError },
  ] = await Promise.all([
    supabase
      .from("ma_sources")
      .select("*, network:ma_source_networks(*)")
      .order("firm_name"),
    supabase
      .from("ma_source_contacts")
      .select("*")
      .order("name", { ascending: true, nullsFirst: false }),
    supabase
      .from("opportunities")
      .select(
        "source_id, reference, public_title, status, date_added, created_at",
      )
      .not("source_id", "is", null),
  ])

  if (sourcesError) throw new Error(sourcesError.message)
  if (contactsError) throw new Error(contactsError.message)
  if (opportunitiesError) throw new Error(opportunitiesError.message)

  const contactsBySource = new Map<string, MaSourceDirectoryEntry["contacts"]>()
  for (const contact of (contacts ??
    []) as MaSourceDirectoryEntry["contacts"]) {
    const current = contactsBySource.get(contact.source_id) ?? []
    current.push(contact)
    contactsBySource.set(contact.source_id, current)
  }

  const opportunitiesBySource = new Map<string, SourceOpportunityRow[]>()
  for (const opportunity of (opportunities ?? []) as SourceOpportunityRow[]) {
    if (!opportunity.source_id) continue
    const current = opportunitiesBySource.get(opportunity.source_id) ?? []
    current.push(opportunity)
    opportunitiesBySource.set(opportunity.source_id, current)
  }

  return ((sources ?? []) as MaSource[]).map((source) => {
    const sourceContacts = contactsBySource.get(source.id) ?? []
    const linkedOpportunities = opportunitiesBySource.get(source.id) ?? []
    const openOpportunities = linkedOpportunities.filter((opportunity) =>
      OPEN_STATUSES.has(opportunity.status),
    )
    const staleOpportunityCount = openOpportunities.filter((opportunity) => {
      const ageDays = getAgeDays(
        opportunity.date_added ?? opportunity.created_at,
      )
      return ageDays !== null && ageDays > STALE_DAYS
    }).length
    const latestOpportunity = [...linkedOpportunities].sort(compareLatest)[0]

    return {
      ...source,
      contacts: sourceContacts,
      contact_count: sourceContacts.length,
      opportunity_count: linkedOpportunities.length,
      open_opportunity_count: openOpportunities.length,
      stale_opportunity_count: staleOpportunityCount,
      latest_opportunity_date: latestOpportunity
        ? latestDate(latestOpportunity)
        : null,
      latest_opportunity_title:
        latestOpportunity?.public_title ?? latestOpportunity?.reference ?? null,
    }
  })
}

export async function listMaSourceContactsDirectory(): Promise<
  MaSourceContactDirectoryEntry[]
> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [
    { data: sources, error: sourcesError },
    { data: contacts, error: contactsError },
    { data: moves, error: movesError },
  ] = await Promise.all([
    supabase
      .from("ma_sources")
      .select("*, network:ma_source_networks(*)")
      .order("firm_name"),
    supabase
      .from("ma_source_contacts")
      .select("*")
      .order("name", { ascending: true, nullsFirst: false }),
    supabase
      .from("ma_source_contact_moves")
      .select(
        "*, old_source:ma_sources!ma_source_contact_moves_old_source_id_fkey(id, firm_name), new_source:ma_sources!ma_source_contact_moves_new_source_id_fkey(id, firm_name)",
      )
      .order("moved_at", { ascending: false }),
  ])

  if (sourcesError) throw new Error(sourcesError.message)
  if (contactsError) throw new Error(contactsError.message)
  if (movesError) throw new Error(movesError.message)

  const sourceById = new Map(
    ((sources ?? []) as MaSource[]).map((source) => [source.id, source]),
  )
  const movesByContact = new Map<string, MaSourceContactMove[]>()
  for (const move of (moves ?? []) as MaSourceContactMove[]) {
    const current = movesByContact.get(move.contact_id) ?? []
    current.push(move)
    movesByContact.set(move.contact_id, current)
  }

  return ((contacts ?? []) as MaSourceContactDirectoryEntry[])
    .map((contact) => {
      const source = sourceById.get(contact.source_id)
      if (!source) return null
      return {
        ...contact,
        source,
        move_history: movesByContact.get(contact.id) ?? [],
      }
    })
    .filter(
      (contact): contact is MaSourceContactDirectoryEntry => contact !== null,
    )
}

export async function createMaSource(
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()

  try {
    const payload = parseSourcePayload(formData)
    const contactPayload = (() => {
      const name = readString(formData, "contact_name")
      const email = readString(formData, "contact_email")
      const phone = readString(formData, "contact_phone")
      return name || email || phone ? parseContactPayload(formData) : null
    })()
    const supabase = createAdminClient()
    const networkId = await resolveNetworkId(supabase, formData, access.user.id)
    const { data, error } = await supabase
      .from("ma_sources")
      .insert({ ...payload, network_id: networkId, created_by: access.user.id })
      .select("id")
      .single()

    if (error) throw new Error(error.message)

    if (contactPayload) {
      const { error: contactError } = await supabase
        .from("ma_source_contacts")
        .insert({
          ...contactPayload,
          source_id: (data as MaSource).id,
          created_by: access.user.id,
        })
      if (contactError) throw new Error(contactError.message)
    }

    revalidateMaSourceSurfaces()
    return { success: true, message: "M&A source created" }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create M&A source",
    }
  }
}

export async function updateMaSource(
  sourceId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()

  try {
    const payload = parseSourcePayload(formData)
    const supabase = createAdminClient()
    const networkId = await resolveNetworkId(supabase, formData, access.user.id)
    const { error } = await supabase
      .from("ma_sources")
      .update({ ...payload, network_id: networkId })
      .eq("id", sourceId)

    if (error) throw new Error(error.message)

    revalidateMaSourceSurfaces()
    return { success: true, message: "M&A source updated" }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update M&A source",
    }
  }
}

export async function createMaSourceContact(
  sourceId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()

  try {
    const payload = parseContactPayload(formData)
    const supabase = createAdminClient()
    const { error } = await supabase
      .from("ma_source_contacts")
      .insert({ ...payload, source_id: sourceId, created_by: access.user.id })

    if (error) throw new Error(error.message)

    revalidateMaSourceSurfaces()
    return { success: true, message: "M&A contact created" }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create M&A contact",
    }
  }
}

export async function updateMaSourceContact(
  sourceId: string,
  contactId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const access = await requireStaffAccess()

  try {
    const payload = parseContactPayload(formData)
    const targetSourceId = readString(formData, "target_source_id") ?? sourceId
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc("move_ma_source_contact", {
      p_contact_id: contactId,
      p_expected_source_id: sourceId,
      p_new_source_id: targetSourceId,
      p_name: payload.name,
      p_email: payload.email,
      p_phone: payload.phone,
      p_moved_by: access.user.id,
    })

    if (error) throw new Error(error.message)
    if (!data) throw new Error("M&A contact not found for this source")

    revalidateMaSourceSurfaces()
    return {
      success: true,
      message:
        targetSourceId === sourceId
          ? "M&A contact updated"
          : "M&A contact moved",
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update M&A contact",
    }
  }
}
