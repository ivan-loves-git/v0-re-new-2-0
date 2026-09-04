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
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
import {
  demoClassificationMutationRow,
  demoClassificationWriteErrorMessage,
} from "@/lib/demo-classification"
import {
  isOpportunityClosureReason,
  isOpportunityPauseReason,
  type MaSource,
  type MaSourceContact,
  type Opportunity,
  type OpportunityActionResult,
  type OpportunityClosureHistoryEntry,
  type OpportunityPauseHistoryEntry,
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

export async function listOpportunityWorkSurfaceRecords(options?: {
  includeSourceReview?: boolean
}): Promise<
  OpportunityWorkSurfaceRecord[]
> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  // Freeze the export boundary before reading. The ID high-water mark excludes
  // later rows regardless of their randomly allocated UUID, while created_at
  // excludes inserts that sort below that mark. ID keyset pagination means a
  // concurrent delete cannot shift an offset and silently skip the next row.
  const opportunityRows: OpportunitySourceRow[] = []
  const pageSize = 500
  const exportStartedAt = new Date().toISOString()
  const { data: highWaterRow, error: highWaterError } = await supabase
    .from("opportunities")
    .select("id")
    .lte("created_at", exportStartedAt)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (highWaterError) throw new Error(highWaterError.message)
  const highWaterId = highWaterRow?.id as string | undefined
  if (!highWaterId) return []

  let lastOpportunityId: string | null = null
  for (;;) {
    let query = supabase
      .from("opportunities")
      .select(OPPORTUNITY_WITH_SOURCE_SELECT)
      .lte("created_at", exportStartedAt)
      .lte("id", highWaterId)
      .order("id", { ascending: true })
      .limit(pageSize)

    if (lastOpportunityId) query = query.gt("id", lastOpportunityId)
    const { data, error } = await query

    if (error) throw new Error(error.message)
    const page = (data ?? []) as OpportunitySourceRow[]
    opportunityRows.push(...page)
    if (page.length < pageSize) break
    const nextCursor = page.at(-1)?.id as string | undefined
    if (!nextCursor || nextCursor === lastOpportunityId) {
      throw new Error("Opportunity export pagination did not advance.")
    }
    lastOpportunityId = nextCursor
  }

  const normalizedOpportunities = opportunityRows.map(normalizeOpportunity)
  // The CSV does not export the W-064 review predicate. Skipping that extra
  // projection keeps every export read paginated, including very large data
  // sets where a single `in(...)` review lookup would itself hit a cap.
  const opportunities = options?.includeSourceReview === false
    ? normalizedOpportunities
    : await withStaffSourceReviewState(supabase, normalizedOpportunities)
  const opportunityIds = opportunities.map((opportunity) => opportunity.id)

  if (opportunityIds.length === 0) {
    return opportunities.map((opportunity) => ({
      ...opportunity,
      matches: [],
    }))
  }

  const matchRows: OpportunityWorkSurfaceMatchRow[] = []
  // Keep UUID lists small enough for conservative PostgREST URL limits.
  const matchOpportunityChunkSize = 100
  for (let start = 0; start < opportunityIds.length; start += matchOpportunityChunkSize) {
    const ids = opportunityIds.slice(start, start + matchOpportunityChunkSize)
    let lastMatchId: string | null = null
    for (;;) {
      let query = supabase
        .from("opportunity_matches")
        .select(
          `
      id,
      opportunity_id,
      status,
      pursuit_stage,
      updated_at,
      repreneur:repreneurs(id, first_name, last_name, email, is_demo, lifecycle_status, journey_stage, recommendation, who_score, when_score)
      `,
        )
        .in("opportunity_id", ids)
        .lte("created_at", exportStartedAt)
        .order("id", { ascending: true })
        .limit(pageSize)

      if (lastMatchId) query = query.gt("id", lastMatchId)
      const { data, error: matchError } = await query

      if (matchError) throw new Error(matchError.message)
      const page = (data ?? []) as OpportunityWorkSurfaceMatchRow[]
      matchRows.push(...page)
      if (page.length < pageSize) break
      const nextCursor = page.at(-1)?.id as string | undefined
      if (!nextCursor || nextCursor === lastMatchId) {
        throw new Error("Opportunity match export pagination did not advance.")
      }
      lastMatchId = nextCursor
    }
  }

  const opportunityById = new Map(
    opportunities.map((opportunity) => [opportunity.id, opportunity]),
  )
  const matchesByOpportunity = new Map<string, OpportunityWorkSurfaceMatch[]>()
  for (const row of matchRows) {
    const match = normalizeWorkSurfaceMatch(row)
    if (!isOpportunityInRepreneurNamespace(
      opportunityById.get(match.opportunity_id),
      match.repreneur,
    )) continue
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

export async function getOpportunityPauseHistory(
  id: string,
): Promise<OpportunityPauseHistoryEntry[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_pause_history")
    .select("id, opportunity_id, reason, previous_status, paused_by, paused_at")
    .eq("opportunity_id", id)
    .order("paused_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as OpportunityPauseHistoryEntry[]
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

/**
 * Changes only the staff-owned DEMO quarantine classification. This deliberately
 * does not alter lifecycle or repreneur visibility; the portal eligibility gate
 * enforces the resulting exclusion.
 */
export async function setOpportunityDemoClassification(
  id: string,
  isDemo: boolean,
): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  if (typeof isDemo !== "boolean") {
    return { success: false, message: "Choose REAL or DEMO." }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .rpc("set_zero_match_demo_classification", {
      p_entity_type: "opportunity",
      p_entity_id: id,
      p_is_demo: isDemo,
      p_actor: user.id,
    })

  if (error) {
    return {
      success: false,
      message: demoClassificationWriteErrorMessage(error, "opportunity"),
    }
  }

  const changed = demoClassificationMutationRow(data)
  if (
    !changed ||
    changed.entity_id !== id ||
    changed.is_demo !== isDemo ||
    (changed.changed && (!changed.changed_at || changed.changed_by !== user.id))
  ) {
    return {
      success: false,
      message: "We could not verify the saved opportunity classification. Please try again.",
    }
  }

  revalidatePath("/opportunities")
  revalidatePath("/opportunities/find")
  revalidatePath(`/opportunities/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/portal")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/profile")
  revalidatePath("/portal/pursuits")
  revalidatePath("/portal-preview")
  revalidateOpportunityDashboardTags()

  return {
    success: true,
    message: changed.changed
      ? isDemo
        ? "Opportunity moved to DEMO-only Deal Flow and excluded from production reporting."
        : "Opportunity moved to REAL Deal Flow and returned to production reporting."
      : `This opportunity is already classified ${isDemo ? "DEMO" : "REAL"}.`,
  }
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

export async function pauseOpportunity(
  id: string,
  reason: unknown,
): Promise<OpportunityActionResult> {
  const { user } = await requireStaffAccess()
  if (!isOpportunityPauseReason(reason)) {
    return {
      success: false,
      message: "Choose the pause reason before pausing this opportunity.",
      fieldErrors: { pause_reason: "Choose a valid pause reason." },
    }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.rpc("pause_opportunity_with_reason", {
    p_opportunity_id: id,
    p_reason: reason,
    p_paused_by: user.id,
  })

  if (error) {
    if (error.message.includes("opportunity_not_active_for_pause")) {
      return {
        success: false,
        message: "Only an active opportunity can be paused.",
      }
    }
    throw new Error(error.message)
  }

  revalidatePath("/opportunities")
  revalidatePath("/opportunities/find")
  revalidatePath(`/opportunities/${id}`)
  revalidatePath("/dashboard")
  revalidatePath("/portal")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/pursuits")
  revalidatePath("/portal-preview")
  revalidateOpportunityDashboardTags()
  return {
    success: true,
    message: "Opportunity paused. The reason is retained in history.",
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
