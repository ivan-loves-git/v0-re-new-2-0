"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { withStaffSourceReviewState } from "@/lib/data/provisional-source-review"
import {
  createOpportunityIntake,
  updateOpportunityIntake,
} from "@/lib/actions/opportunity-intake"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isOpportunityClosureReason,
  type MaSource,
  type MaSourceContact,
  type Opportunity,
  type OpportunityActionResult,
  type OpportunityClosureHistoryEntry,
  type OpportunityMaContact,
  type OpportunitySourceOffice,
  type OpportunitySourceContact,
  type Opportunity_Insert,
  type OpportunityWithSource,
  type OpportunityWorkSurfaceMatch,
  type OpportunityWorkSurfaceRecord,
} from "@/lib/types/opportunity"

type MaSourceQueryRow = Omit<MaSource, "contacts"> & {
  contacts?: MaSourceContact | MaSourceContact[] | null
}

type OpportunitySourceContactQueryRow = Omit<
  OpportunitySourceContact,
  "contact"
> & {
  contact?: MaSourceContact | MaSourceContact[] | null
}

type OpportunityOfficeContactQueryRow = Omit<
  OpportunityMaContact,
  "affiliation"
> & {
  affiliation?:
    | NonNullable<OpportunityMaContact["affiliation"]>
    | NonNullable<OpportunityMaContact["affiliation"]>[]
    | null
}

type OpportunitySourceRow = Record<string, unknown> & {
  source?: MaSourceQueryRow | MaSourceQueryRow[] | null
  source_contacts?: OpportunitySourceContactQueryRow[] | null
  source_office?: OpportunitySourceOffice | OpportunitySourceOffice[] | null
  office_contacts?: OpportunityOfficeContactQueryRow[] | null
}

type OpportunityWorkSurfaceMatchRow = Record<string, unknown> & {
  repreneur?:
    | OpportunityWorkSurfaceMatch["repreneur"]
    | OpportunityWorkSurfaceMatch["repreneur"][]
    | null
}

const OPPORTUNITY_WITH_SOURCE_SELECT = `
  *,
  source:ma_sources(
    id,
    firm_name,
    source_type,
    internal_notes,
    created_by,
    created_at,
    updated_at,
    contacts:ma_source_contacts(
      id,
      source_id,
      name,
      email,
      phone,
      created_by,
      created_at,
      updated_at
    )
  ),
  source_contacts:opportunity_source_contacts(
    opportunity_id,
    source_id,
    contact_id,
    is_primary,
    contact_name_snapshot,
    contact_email_snapshot,
    contact_phone_snapshot,
    created_by,
    created_at,
    contact:ma_source_contacts(
      id,
      source_id,
      name,
      email,
      phone,
      created_by,
      created_at,
      updated_at
    )
  ),
  source_office:ma_offices(
    id,
    name,
    is_default,
    firm:ma_firms(
      id,
      name
    )
  ),
  office_contacts:opportunity_ma_contacts(
    id,
    opportunity_id,
    affiliation_id,
    is_primary,
    is_active,
    contact_name_snapshot,
    contact_email_snapshot,
    contact_phone_snapshot,
    affiliation:ma_contact_office_affiliations(
      id,
      office_id,
      contact:ma_contacts(
        id,
        display_name,
        email,
        phone,
        status
      )
    )
  )
`

function normalizeSource(
  source: MaSourceQueryRow | null | undefined,
): MaSource | null {
  if (!source) return null
  const contacts = Array.isArray(source.contacts)
    ? source.contacts
    : source.contacts
      ? [source.contacts]
      : []
  return { ...source, contacts }
}

function normalizeSourceContact(
  row: OpportunitySourceContactQueryRow,
): OpportunitySourceContact {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
  return {
    ...row,
    contact: contact
      ? {
          ...contact,
          source_id: row.source_id,
          name: row.contact_name_snapshot ?? contact.name,
          email: row.contact_email_snapshot ?? contact.email,
          phone: row.contact_phone_snapshot ?? contact.phone,
        }
      : null,
  }
}

function normalizeOfficeContact(
  row: OpportunityOfficeContactQueryRow,
): OpportunityMaContact {
  const affiliation = Array.isArray(row.affiliation)
    ? row.affiliation[0]
    : row.affiliation
  const contact = Array.isArray(affiliation?.contact)
    ? affiliation.contact[0]
    : affiliation?.contact

  return {
    ...row,
    affiliation: affiliation
      ? {
          ...affiliation,
          contact: contact ?? null,
        }
      : null,
  }
}

function normalizeOpportunity(
  row: OpportunitySourceRow,
): OpportunityWithSource {
  const sourceRow = Array.isArray(row.source) ? row.source[0] : row.source
  const sourceOffice = Array.isArray(row.source_office)
    ? row.source_office[0]
    : row.source_office
  return {
    ...row,
    source: normalizeSource(sourceRow),
    source_contacts: Array.isArray(row.source_contacts)
      ? row.source_contacts.map(normalizeSourceContact)
      : [],
    source_office: sourceOffice ?? null,
    office_contacts: Array.isArray(row.office_contacts)
      ? row.office_contacts.map(normalizeOfficeContact)
      : [],
  } as OpportunityWithSource
}

function normalizeWorkSurfaceMatch(
  row: OpportunityWorkSurfaceMatchRow,
): OpportunityWorkSurfaceMatch {
  const repreneur = Array.isArray(row.repreneur)
    ? row.repreneur[0]
    : row.repreneur
  return {
    ...row,
    repreneur: repreneur ?? null,
  } as OpportunityWorkSurfaceMatch
}

export async function listOpportunities(): Promise<OpportunityWithSource[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_SOURCE_SELECT)
    .order("date_added", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return withStaffSourceReviewState(supabase, (data ?? []).map(normalizeOpportunity))
}

export async function listOpportunityWorkSurfaceRecords(): Promise<
  OpportunityWorkSurfaceRecord[]
> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_SOURCE_SELECT)
    .order("date_added", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  const opportunities = await withStaffSourceReviewState(
    supabase,
    (data ?? []).map(normalizeOpportunity),
  )
  const opportunityIds = opportunities.map((opportunity) => opportunity.id)

  if (opportunityIds.length === 0) {
    return opportunities.map((opportunity) => ({
      ...opportunity,
      matches: [],
    }))
  }

  const { data: matchRows, error: matchError } = await supabase
    .from("opportunity_matches")
    .select(
      `
      id,
      opportunity_id,
      status,
      pursuit_stage,
      updated_at,
      repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)
    `,
    )
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

export async function getOpportunity(
  id: string,
): Promise<OpportunityWithSource | null> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_WITH_SOURCE_SELECT)
    .eq("id", id)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(error.message)
  }

  return (await withStaffSourceReviewState(supabase, [normalizeOpportunity(data)]))[0]
}

export async function getOpportunityClosureHistory(
  id: string,
): Promise<OpportunityClosureHistoryEntry[]> {
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
  return createOpportunityIntake(formData)
}

export async function createOpportunityFromDraft(
  _draft: Opportunity_Insert,
): Promise<Opportunity> {
  void _draft
  await requireStaffAccess()
  throw new Error(
    "Direct opportunity creation is retired. Use the canonical Opportunity Intake.",
  )
}

export async function updateOpportunity(id: string, formData: FormData) {
  return updateOpportunityIntake(id, formData)
}

export async function closeOpportunity(
  id: string,
  reason: unknown,
): Promise<OpportunityActionResult> {
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
    if (error.message.includes("ma_provisional_source_review_blocks_opportunity_lifecycle_exit")) {
      return {
        success: false,
        message: "Close is unavailable until the provisional source is corrected.",
      }
    }
    throw new Error(error.message)
  }

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
  return {
    success: true,
    message: "Opportunity closed. Its closure reason is retained in history.",
  }
}

export async function reopenOpportunity(
  _id: string,
): Promise<OpportunityActionResult> {
  void _id
  await requireStaffAccess()
  return {
    success: false,
    message:
      "Reopening is temporarily unavailable until its dedicated canonical office and primary-contact workflow is released.",
    fieldErrors: {
      status:
        "A closed opportunity cannot be reactivated through the legacy source-only path.",
    },
  }
}

export async function archiveOpportunity(id: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("opportunities")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    if (error.message.includes("ma_provisional_source_review_blocks_opportunity_lifecycle_exit")) {
      throw new Error("Archive is unavailable until the provisional source is corrected.")
    }
    throw new Error(error.message)
  }

  revalidatePath("/opportunities")
  revalidatePath(`/opportunities/${id}`)
  revalidateOpportunityDashboardTags()
}
