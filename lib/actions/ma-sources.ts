"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  MaSource,
  MaSourceContactDirectoryEntry,
  MaSourceContactMove,
  MaSourceDirectoryEntry,
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
const STALE_DAYS = 90

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
  _formData: FormData,
): Promise<{ success: boolean; message: string }> {
  void _formData
  await requireStaffAccess()
  return retiredLegacyMutation()
}

export async function updateMaSource(
  _sourceId: string,
  _formData: FormData,
): Promise<{ success: boolean; message: string }> {
  void _sourceId
  void _formData
  await requireStaffAccess()
  return retiredLegacyMutation()
}

export async function createMaSourceContact(
  _sourceId: string,
  _formData: FormData,
): Promise<{ success: boolean; message: string }> {
  void _sourceId
  void _formData
  await requireStaffAccess()
  return retiredLegacyMutation()
}

export async function updateMaSourceContact(
  _sourceId: string,
  _contactId: string,
  _formData: FormData,
): Promise<{ success: boolean; message: string }> {
  void _sourceId
  void _contactId
  void _formData
  await requireStaffAccess()
  return retiredLegacyMutation()
}

function retiredLegacyMutation() {
  return {
    success: false,
    message:
      "Legacy M&A directory editing is retired. Use Opportunity Intake to create the canonical firm, office, and contact context.",
  }
}
