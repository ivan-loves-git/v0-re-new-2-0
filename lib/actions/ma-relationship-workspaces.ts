"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import {
  isCandidateStaleOpportunity,
  isClosedOpportunity,
  isCountedSourcedOpportunity,
  isOpenRelationshipOpportunity,
} from "@/lib/opportunity-freshness-policy"
import { createAdminClient } from "@/lib/supabase/admin"
import type { OpportunityStatus } from "@/lib/types/opportunity"

type Relation<T> = T | T[] | null | undefined
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export interface MaWorkspaceContact {
  id: string
  affiliationId: string
  name: string
  email: string | null
  jobTitle: string | null
  isActive: boolean
  endedAt: string | null
}

export interface MaWorkspaceOpportunity {
  id: string
  reference: string
  label: string
  status: OpportunityStatus
  dateAdded: string | null
  isCandidateStale: boolean
}

export interface MaWorkspaceActivity {
  id: string
  channel: string
  title: string | null
  occurredAt: string
  opportunityId: string | null
  opportunityLabel: string | null
}

export interface MaWorkspaceIndicators {
  activeContacts: number
  historicalAffiliations: number
  opportunities: number
  openOpportunities: number
  staleOpportunities: number
  closedOpportunities: number
  latestKnownOpportunityDate: string | null
}

export interface MaOfficeWorkspace {
  id: string
  firmId: string
  firmName: string
  name: string
  city: string | null
  status: "active" | "archived"
  isDefault: boolean
  internalNotes: string | null
  createdAt: string | null
  updatedAt: string | null
  updatedBy: string | null
  contacts: MaWorkspaceContact[]
  opportunities: MaWorkspaceOpportunity[]
  activity: MaWorkspaceActivity[]
  indicators: MaWorkspaceIndicators
}

export interface MaFirmWorkspace {
  id: string
  name: string
  status: "prospect" | "active" | "archived"
  internalNotes: string | null
  createdAt: string | null
  updatedAt: string | null
  updatedBy: string | null
  offices: Array<
    Pick<
      MaOfficeWorkspace,
      "id" | "name" | "city" | "status" | "isDefault" | "indicators"
    >
  >
  contacts: MaWorkspaceContact[]
  opportunities: MaWorkspaceOpportunity[]
  activity: MaWorkspaceActivity[]
  indicators: MaWorkspaceIndicators
}

function opportunityLabel(row: {
  reference: string
  public_title: string | null
  activity: string | null
}) {
  return [row.reference, row.public_title ?? row.activity]
    .filter(Boolean)
    .join(" · ")
}

function buildIndicators(
  contacts: MaWorkspaceContact[],
  opportunities: MaWorkspaceOpportunity[],
): MaWorkspaceIndicators {
  return {
    activeContacts: contacts.filter((contact) => contact.isActive).length,
    historicalAffiliations: contacts.filter((contact) => !contact.isActive)
      .length,
    opportunities: opportunities.filter((opportunity) =>
      isCountedSourcedOpportunity(opportunity.status),
    ).length,
    openOpportunities: opportunities.filter((opportunity) =>
      isOpenRelationshipOpportunity(opportunity.status),
    ).length,
    staleOpportunities: opportunities.filter(
      (opportunity) => opportunity.isCandidateStale,
    ).length,
    closedOpportunities: opportunities.filter((opportunity) =>
      isClosedOpportunity(opportunity.status),
    ).length,
    latestKnownOpportunityDate:
      opportunities
        .map((opportunity) => opportunity.dateAdded)
        .filter((date): date is string => Boolean(date))
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
  }
}

async function getWorkspaceRows(officeIds: string[]) {
  const supabase = createAdminClient()
  const [
    affiliationsResult,
    opportunitiesResult,
    interactionsResult,
    pursuitsResult,
  ] = await Promise.all([
    supabase
      .from("ma_contact_office_affiliations")
      .select(
        "id, office_id, job_title, is_active, ended_at, contact:ma_contacts(id, display_name, email, status)",
      )
      .in("office_id", officeIds)
      .order("is_active", { ascending: false }),
    supabase
      .from("opportunities")
      .select(
        "id, reference, public_title, activity, status, date_added, source_office_id",
      )
      .in("source_office_id", officeIds)
      .order("date_added", { ascending: false, nullsFirst: false }),
    supabase
      .from("ma_interactions")
      .select(
        "id, office_id, opportunity_id, channel, title, occurred_at, opportunity:opportunities(reference, public_title, activity)",
      )
      .in("office_id", officeIds)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("opportunity_matches")
      .select("opportunity_id")
      .eq("status", "active_pursuit"),
  ])
  for (const result of [
    affiliationsResult,
    opportunitiesResult,
    interactionsResult,
    pursuitsResult,
  ]) {
    if (result.error) throw new Error(result.error.message)
  }
  const activePursuitIds = new Set(
    (pursuitsResult.data ?? [])
      .map((row) => row.opportunity_id)
      .filter((id): id is string => Boolean(id)),
  )
  const now = new Date()
  const contactsByOffice = new Map<string, MaWorkspaceContact[]>()
  for (const row of affiliationsResult.data ?? []) {
    const contact = one(
      row.contact as Relation<{
        id: string
        display_name: string | null
        email: string | null
        status: string
      }>,
    )
    if (!contact) continue
    const entries = contactsByOffice.get(row.office_id) ?? []
    entries.push({
      id: contact.id,
      affiliationId: row.id,
      name: contact.display_name || contact.email || "Unnamed contact",
      email: contact.email,
      jobTitle: row.job_title,
      isActive: row.is_active && !row.ended_at && contact.status === "active",
      endedAt: row.ended_at,
    })
    contactsByOffice.set(row.office_id, entries)
  }
  const opportunitiesByOffice = new Map<string, MaWorkspaceOpportunity[]>()
  for (const row of opportunitiesResult.data ?? []) {
    if (!row.source_office_id) continue
    const entries = opportunitiesByOffice.get(row.source_office_id) ?? []
    entries.push({
      id: row.id,
      reference: row.reference,
      label: opportunityLabel(row),
      status: row.status as OpportunityStatus,
      dateAdded: row.date_added,
      isCandidateStale: isCandidateStaleOpportunity(
        {
          id: row.id,
          status: row.status as OpportunityStatus,
          dateAdded: row.date_added,
        },
        activePursuitIds,
        now,
      ),
    })
    opportunitiesByOffice.set(row.source_office_id, entries)
  }
  const activityByOffice = new Map<string, MaWorkspaceActivity[]>()
  for (const row of interactionsResult.data ?? []) {
    const opportunity = one(
      row.opportunity as Relation<{
        reference: string
        public_title: string | null
        activity: string | null
      }>,
    )
    const entries = activityByOffice.get(row.office_id) ?? []
    entries.push({
      id: row.id,
      channel: row.channel,
      title: row.title,
      occurredAt: row.occurred_at,
      opportunityId: row.opportunity_id,
      opportunityLabel: opportunity ? opportunityLabel(opportunity) : null,
    })
    activityByOffice.set(row.office_id, entries)
  }
  return { contactsByOffice, opportunitiesByOffice, activityByOffice }
}

export async function getMaOfficeWorkspace(
  officeId: string,
): Promise<MaOfficeWorkspace | null> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ma_offices")
    .select(
      "id, firm_id, name, city, status, is_default, internal_notes, created_at, updated_at, updated_by, firm:ma_firms(id, name)",
    )
    .eq("id", officeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const firm = one(data.firm as Relation<{ id: string; name: string }>)
  if (!firm) return null
  const { contactsByOffice, opportunitiesByOffice, activityByOffice } =
    await getWorkspaceRows([data.id])
  const contacts = contactsByOffice.get(data.id) ?? []
  const opportunities = opportunitiesByOffice.get(data.id) ?? []
  const activity = activityByOffice.get(data.id) ?? []
  return {
    id: data.id,
    firmId: firm.id,
    firmName: firm.name,
    name: data.name,
    city: data.city,
    status: data.status,
    isDefault: data.is_default,
    internalNotes: data.internal_notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
    contacts,
    opportunities,
    activity,
    indicators: buildIndicators(contacts, opportunities),
  }
}

export async function getMaFirmWorkspace(
  firmId: string,
): Promise<MaFirmWorkspace | null> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data: firm, error } = await supabase
    .from("ma_firms")
    .select(
      "id, name, status, internal_notes, created_at, updated_at, updated_by, offices:ma_offices(id, name, city, status, is_default)",
    )
    .eq("id", firmId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!firm) return null
  const officeRows = (firm.offices ?? []) as Array<{
    id: string
    name: string
    city: string | null
    status: "active" | "archived"
    is_default: boolean
  }>
  const officeIds = officeRows.map((office) => office.id)
  const { contactsByOffice, opportunitiesByOffice, activityByOffice } =
    officeIds.length
      ? await getWorkspaceRows(officeIds)
      : {
          contactsByOffice: new Map<string, MaWorkspaceContact[]>(),
          opportunitiesByOffice: new Map<string, MaWorkspaceOpportunity[]>(),
          activityByOffice: new Map<string, MaWorkspaceActivity[]>(),
        }
  const offices = officeRows
    .map((office) => {
      const contacts = contactsByOffice.get(office.id) ?? []
      const opportunities = opportunitiesByOffice.get(office.id) ?? []
      return {
        ...office,
        isDefault: office.is_default,
        indicators: buildIndicators(contacts, opportunities),
      }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
  const contactsById = new Map<string, MaWorkspaceContact>()
  for (const contacts of contactsByOffice.values())
    for (const contact of contacts) {
      if (contact.isActive) contactsById.set(contact.id, contact)
    }
  const opportunities = [...opportunitiesByOffice.values()].flat()
  const activity = [...activityByOffice.values()]
    .flat()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  const contacts = [...contactsById.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )
  return {
    id: firm.id,
    name: firm.name,
    status: firm.status,
    internalNotes: firm.internal_notes,
    createdAt: firm.created_at,
    updatedAt: firm.updated_at,
    updatedBy: firm.updated_by,
    offices,
    contacts,
    opportunities,
    activity,
    indicators: buildIndicators(contacts, opportunities),
  }
}

export async function updateMaRelationshipWorkspaceNotes(
  target: "office" | "firm",
  id: string,
  internalNotes: string,
) {
  if ((target !== "office" && target !== "firm") || !UUID_PATTERN.test(id)) {
    return { success: false, message: "Choose a valid M&A record." }
  }
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()
  const table = target === "office" ? "ma_offices" : "ma_firms"
  const { data, error } = await supabase
    .from(table)
    .update({
      internal_notes: internalNotes.trim() || null,
      updated_by: user.id,
    })
    .eq("id", id)
    .select("id, updated_by, updated_at")
    .maybeSingle()
  if (error)
    return { success: false, message: "Internal notes could not be saved." }
  if (!data)
    return { success: false, message: "This M&A record no longer exists." }
  revalidatePath(
    target === "office"
      ? `/opportunities/ma/offices/${id}`
      : `/opportunities/ma/firms/${id}`,
  )
  return {
    success: true,
    message: "Internal notes saved with staff audit.",
    audit: { updatedBy: data.updated_by, updatedAt: data.updated_at },
  }
}
