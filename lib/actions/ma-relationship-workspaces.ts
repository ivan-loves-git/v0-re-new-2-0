"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import type { MaRelationshipActivityProvenance } from "@/lib/ma-relationship-activity-provenance"
import {
  compareMaRelationshipActivityDescending,
  readMaRelationshipLedger,
} from "@/lib/data/ma-relationship-ledger"
import { isCandidateStaleOpportunity } from "@/lib/opportunity-freshness-policy"
import { buildMaRelationshipIndicators } from "@/lib/ma-relationship-statistics"
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
  dateAddedPrecision: "day" | "month" | null
  isCandidateStale: boolean
}

export interface MaWorkspaceActivity {
  id: string
  channel: string
  title: string | null
  occurredAt: string
  activityProvenance: MaRelationshipActivityProvenance
  deliveryStatus: "pending" | "sent" | "failed" | null
  providerIdempotencyKey: string | null
  providerMessageId: string | null
  deliveryFinalizedAt: string | null
  sentAt: string | null
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
  latestKnownOpportunityDatePrecision: "day" | "month" | null
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

function projectIndicators(statistics: {
  activeContactCount: number
  historicalAffiliationCount: number
  sourcedOpportunityCount: number
  openOpportunityCount: number
  candidateStaleCount: number
  closedOpportunityCount: number
  latestKnownAt: string | null
  latestKnownAtPrecision: "day" | "month" | null
}): MaWorkspaceIndicators {
  return {
    activeContacts: statistics.activeContactCount,
    historicalAffiliations: statistics.historicalAffiliationCount,
    opportunities: statistics.sourcedOpportunityCount,
    openOpportunities: statistics.openOpportunityCount,
    staleOpportunities: statistics.candidateStaleCount,
    closedOpportunities: statistics.closedOpportunityCount,
    latestKnownOpportunityDate: statistics.latestKnownAt,
    latestKnownOpportunityDatePrecision: statistics.latestKnownAtPrecision,
  }
}

async function getWorkspaceRows(
  offices: Array<{ id: string; firmId: string | null }>,
) {
  const now = new Date()
  const ledger = await readMaRelationshipLedger({
    purpose: "detail",
    officeIds: offices.map((office) => office.id),
  })
  const indicators = buildMaRelationshipIndicators(
    offices,
    [...ledger.affiliationsByOffice.values()].flat().map((affiliation) => ({
      officeId: affiliation.officeId,
      contactId: affiliation.contactId,
      isActive: affiliation.isActive,
      endedAt: affiliation.endedAt,
      contactStatus: affiliation.contactStatus,
    })),
    [...ledger.opportunitiesByOffice.values()].flat().map((opportunity) => ({
      id: opportunity.id,
      officeId: opportunity.officeId,
      status: opportunity.status,
      dateAdded: opportunity.dateAdded,
      dateAddedPrecision: opportunity.dateAddedPrecision,
    })),
    ledger.activePursuitOpportunityIds,
  )
  const contactsByOffice = new Map<string, MaWorkspaceContact[]>()
  for (const row of [...ledger.affiliationsByOffice.values()].flat()) {
    const entries = contactsByOffice.get(row.officeId) ?? []
    entries.push({
      id: row.contactId,
      affiliationId: row.id,
      name: row.contactLabel,
      email: row.contactEmail,
      jobTitle: row.jobTitle,
      isActive: row.isActive && !row.endedAt && row.contactStatus === "active",
      endedAt: row.endedAt,
    })
    contactsByOffice.set(row.officeId, entries)
  }
  const opportunitiesByOffice = new Map<string, MaWorkspaceOpportunity[]>()
  for (const row of [...ledger.opportunitiesByOffice.values()].flat()) {
    const entries = opportunitiesByOffice.get(row.officeId) ?? []
    entries.push({
      id: row.id,
      reference: row.reference,
      label: row.label,
      status: row.status,
      dateAdded: row.dateAdded,
      dateAddedPrecision: row.dateAddedPrecision,
      isCandidateStale: isCandidateStaleOpportunity(
        {
          id: row.id,
          status: row.status,
          dateAdded: row.dateAdded,
          dateAddedPrecision: row.dateAddedPrecision,
        },
        ledger.activePursuitOpportunityIds,
        now,
      ),
    })
    opportunitiesByOffice.set(row.officeId, entries)
  }
  const activityByOffice = new Map<string, MaWorkspaceActivity[]>()
  for (const row of [...ledger.activitiesByOffice.values()].flat()) {
    const entries = activityByOffice.get(row.officeId) ?? []
    entries.push({
      id: row.id,
      channel: row.channel,
      title: row.title,
      occurredAt: row.occurredAt,
      activityProvenance: row.activityProvenance,
      deliveryStatus: row.deliveryStatus,
      providerIdempotencyKey: row.providerIdempotencyKey,
      providerMessageId: row.providerMessageId,
      deliveryFinalizedAt: row.deliveryFinalizedAt,
      sentAt: row.sentAt,
      opportunityId: row.opportunityId,
      opportunityLabel: row.opportunityLabel,
    })
    activityByOffice.set(row.officeId, entries)
  }
  return {
    contactsByOffice,
    opportunitiesByOffice,
    activityByOffice,
    indicators,
  }
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
  const {
    contactsByOffice,
    opportunitiesByOffice,
    activityByOffice,
    indicators,
  } = await getWorkspaceRows([{ id: data.id, firmId: firm.id }])
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
    indicators: projectIndicators(
      indicators.byOfficeId.get(data.id) ?? {
        activeContactCount: 0,
        historicalAffiliationCount: 0,
        sourcedOpportunityCount: 0,
        openOpportunityCount: 0,
        candidateStaleCount: 0,
        closedOpportunityCount: 0,
        latestKnownAt: null,
        latestKnownAtPrecision: null,
      },
    ),
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
  const {
    contactsByOffice,
    opportunitiesByOffice,
    activityByOffice,
    indicators,
  } = officeIds.length
    ? await getWorkspaceRows(
        officeRows.map((office) => ({ id: office.id, firmId: firm.id })),
      )
    : {
        contactsByOffice: new Map<string, MaWorkspaceContact[]>(),
        opportunitiesByOffice: new Map<string, MaWorkspaceOpportunity[]>(),
        activityByOffice: new Map<string, MaWorkspaceActivity[]>(),
        indicators: { byOfficeId: new Map(), byFirmId: new Map() },
      }
  const offices = officeRows
    .map((office) => {
      return {
        ...office,
        isDefault: office.is_default,
        indicators: projectIndicators(
          indicators.byOfficeId.get(office.id) ?? {
            activeContactCount: 0,
            historicalAffiliationCount: 0,
            sourcedOpportunityCount: 0,
            openOpportunityCount: 0,
            candidateStaleCount: 0,
            closedOpportunityCount: 0,
            latestKnownAt: null,
            latestKnownAtPrecision: null,
          },
        ),
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
    .sort(compareMaRelationshipActivityDescending)
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
    indicators: projectIndicators(
      indicators.byFirmId.get(firm.id) ?? {
        activeContactCount: 0,
        historicalAffiliationCount: 0,
        sourcedOpportunityCount: 0,
        openOpportunityCount: 0,
        candidateStaleCount: 0,
        closedOpportunityCount: 0,
        latestKnownAt: null,
        latestKnownAtPrecision: null,
        officeCount: officeRows.length,
      },
    ),
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
