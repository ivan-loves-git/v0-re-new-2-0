"use server"

import { requireStaffAccess } from "@/lib/access-control"
import {
  normalizePortalRepreneurProfile,
  PORTAL_REPRENEUR_PROFILE_SELECT,
  type PortalRepreneurProfile,
} from "@/lib/data/portal-profile"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { listLockedOpportunityInterestStateByMatch } from "@/lib/data/locked-opportunity-interest-state"
import { safeRepreneurTeaserSummary } from "@/lib/opportunity-confidentiality"
import { formatOpportunitySourceDate } from "@/lib/utils/opportunity-source-date"
import { isRepreneurEligibleOpportunity } from "@/lib/repreneur-opportunity-eligibility"
import type {
  OpportunityDeclineReasonCategory,
  OpportunityMatchStatus,
  RepreneurOpportunityExposure,
  RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"

const VISIBLE_MATCH_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined", "active_pursuit", "dropped"]
const DECLINE_REASON_CATEGORIES = new Set<OpportunityDeclineReasonCategory>([
  "geography",
  "sector",
  "size_metrics",
  "business_model",
  "other",
])

interface PortalRoleRow {
  role: string
  email: string | null
  repreneur_id: string | null
}

interface PreviewRepreneurRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  lifecycle_status: string | null
}

interface PreviewOpportunityRow {
  id: string
  is_demo: boolean
  reference: string
  status: string | null
  repreneur_exposure: string | null
  public_title: string | null
  teaser_summary: string | null
  description: string | null
  sector: string | null
  activity: string | null
  location: string | null
  revenue_meur: number | null
  ebitda_keur: number | null
  headcount: number | null
  headcount_range: string | null
  date_added: string | null
  date_added_precision: "day" | "month" | null
}

interface PreviewOpportunityMatchRow {
  id: string
  status: RepreneurOpportunityExposure["match_status"]
  decline_reason_categories: unknown
  decline_reason_text: string | null
  pursuit_stage: RepreneurOpportunityExposure["pursuit_stage"]
  pursuit_stage_updated_at: string | null
  nda_status: RepreneurOpportunityExposure["nda_status"]
  nda_signed_at: string | null
  nda_waived_at: string | null
  nda_waived_by: string | null
  nda_updated_at: string | null
  interest_expressed_at?: string | null
  interest_notification_sent_at?: string | null
  updated_at: string
  opportunity: PreviewOpportunityRow | PreviewOpportunityRow[] | null
}

interface PreviewOpportunityCountRow {
  repreneur_id: string
  opportunity: Pick<PreviewOpportunityRow, "is_demo" | "status">
    | Array<Pick<PreviewOpportunityRow, "is_demo" | "status">>
    | null
}

export interface StaffPortalPreviewOption {
  id: string
  name: string
  email: string | null
  lifecycleStatus: string | null
  hasPortalAccess: boolean
  visibleOpportunityCount: number
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

function fullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Unnamed repreneur"
}

function normalizeProfile(row: PreviewRepreneurRow): RepreneurOpportunityProfile {
  return {
    id: row.id,
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    email: row.email ?? "",
  }
}

function normalizeExposure(row: PreviewOpportunityMatchRow): RepreneurOpportunityExposure | null {
  const opportunity = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity
  if (!opportunity) return null
  if (!isRepreneurEligibleOpportunity(opportunity)) return null
  if (opportunity.status !== "active") return null

  // Staff Portal Preview mirrors the exact owned-match projection. A
  // staff_only opportunity is excluded from broad discovery, not from the
  // intended repreneur's proposed or retained match history.

  return {
    match_id: row.id,
    match_status: row.status,
    pursuit_stage: row.pursuit_stage,
    pursuit_stage_updated_at: row.pursuit_stage_updated_at,
    nda_status: row.nda_status,
    nda_updated_at: row.nda_updated_at,
    visible_documents: [],
    opportunity_id: opportunity.id,
    reference: opportunity.reference,
    public_title: opportunity.public_title,
    teaser_summary: safeRepreneurTeaserSummary(
      opportunity.teaser_summary,
      opportunity.description,
    ),
    sector: opportunity.sector,
    activity: opportunity.activity,
    location: opportunity.location,
    revenue_meur: opportunity.revenue_meur,
    ebitda_keur: opportunity.ebitda_keur,
    headcount: opportunity.headcount,
    headcount_range: opportunity.headcount_range,
    date_added: opportunity.date_added,
    date_added_display: formatOpportunitySourceDate(
      opportunity.date_added,
      opportunity.date_added_precision,
    ),
    decline_reason_categories: Array.isArray(row.decline_reason_categories)
      ? row.decline_reason_categories.filter((reason: unknown): reason is OpportunityDeclineReasonCategory =>
          typeof reason === "string" && DECLINE_REASON_CATEGORIES.has(reason as OpportunityDeclineReasonCategory)
        )
      : [],
    decline_reason_text: row.decline_reason_text,
    interest_expressed_at: row.interest_expressed_at,
    interest_notification_sent_at: row.interest_notification_sent_at,
    updated_at: row.updated_at,
  }
}

async function getActivePursuitOwners(
  supabase: ReturnType<typeof createAdminClient>,
  opportunityIds: string[]
): Promise<Map<string, string>> {
  if (opportunityIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("opportunity_id, repreneur_id")
    .in("opportunity_id", opportunityIds)
    .eq("status", "active_pursuit")

  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((row) => [row.opportunity_id, row.repreneur_id]))
}

function isLockedForOtherRepreneur(
  opportunityId: string,
  currentRepreneurId: string,
  activeOwnerByOpportunity: Map<string, string>
) {
  const activeOwner = activeOwnerByOpportunity.get(opportunityId)
  return Boolean(activeOwner && activeOwner !== currentRepreneurId)
}

async function getRepreneurProfileById(
  supabase: ReturnType<typeof createAdminClient>,
  repreneurId: string
): Promise<RepreneurOpportunityProfile | null> {
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, lifecycle_status")
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? normalizeProfile(data as PreviewRepreneurRow) : null
}

async function listVisibleOpportunitiesForRepreneur(
  supabase: ReturnType<typeof createAdminClient>,
  repreneurId: string,
  matchId?: string
) {
  let query = supabase
    .from("opportunity_matches")
    .select(`
      id,
      status,
      decline_reason_categories,
      decline_reason_text,
      pursuit_stage,
      pursuit_stage_updated_at,
      nda_status,
      nda_signed_at,
      nda_waived_at,
      nda_waived_by,
      nda_updated_at,
      updated_at,
      opportunity:opportunities!inner(
        id,
        is_demo,
        reference,
        status,
        repreneur_exposure,
        public_title,
        teaser_summary,
        description,
        sector,
        activity,
        location,
        revenue_meur,
        ebitda_keur,
        headcount,
        headcount_range,
        date_added,
        date_added_precision
      )
    `)
    .eq("repreneur_id", repreneurId)
    .eq("opportunity.is_demo", false)
    .in("status", VISIBLE_MATCH_STATUSES)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })

  if (matchId) {
    query = query.eq("id", matchId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const opportunities = (data ?? [])
    .map((row) => normalizeExposure(row as PreviewOpportunityMatchRow))
    .filter((record): record is RepreneurOpportunityExposure => Boolean(record))

  const activeOwnerByOpportunity = await getActivePursuitOwners(
    supabase,
    opportunities.map((opportunity) => opportunity.opportunity_id)
  )
  const interestStateByMatch = await listLockedOpportunityInterestStateByMatch(
    supabase,
    opportunities.map((opportunity) => opportunity.match_id),
  )

  return opportunities
    .map((exposure) => ({
      ...exposure,
      ...interestStateByMatch.get(exposure.match_id),
      is_locked_for_other_repreneur: isLockedForOtherRepreneur(
        exposure.opportunity_id,
        repreneurId,
        activeOwnerByOpportunity,
      ),
      // Exact IM disclosure is intentionally resolved only by the canonical
      // pursuit projection in the preview detail route.
      visible_documents: [],
    }))
}

export async function listStaffPortalPreviewOptions(): Promise<StaffPortalPreviewOption[]> {
  await requireStaffAccess()

  const supabase = createAdminClient()
  const [repreneursResult, rolesResult, matchesResult] = await Promise.all([
    supabase
      .from("repreneurs")
      .select("id, first_name, last_name, email, lifecycle_status")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("app_user_roles")
      .select("role, email, repreneur_id")
      .eq("role", "repreneur"),
    supabase
      .from("opportunity_matches")
      .select("repreneur_id, status, opportunity:opportunities!inner(is_demo,status)")
      .eq("opportunity.is_demo", false)
      .in("status", VISIBLE_MATCH_STATUSES),
  ])

  if (repreneursResult.error) throw new Error(repreneursResult.error.message)
  if (rolesResult.error && rolesResult.error.code !== "42P01") throw new Error(rolesResult.error.message)
  if (matchesResult.error) throw new Error(matchesResult.error.message)

  const roles = (rolesResult.data as PortalRoleRow[] | null) ?? []
  const roleRepreneurIds = new Set(roles.map((role) => role.repreneur_id).filter(Boolean))
  const roleEmails = new Set(roles.map((role) => normalizeEmail(role.email)).filter(Boolean))
  const visibleCountByRepreneur = new Map<string, number>()

  for (const match of (matchesResult.data ?? []) as PreviewOpportunityCountRow[]) {
    const opportunity = Array.isArray(match.opportunity)
      ? match.opportunity[0]
      : match.opportunity
    if (!opportunity || !isRepreneurEligibleOpportunity(opportunity)) continue
    if (opportunity.status !== "active") continue
    visibleCountByRepreneur.set(match.repreneur_id, (visibleCountByRepreneur.get(match.repreneur_id) ?? 0) + 1)
  }

  return ((repreneursResult.data as PreviewRepreneurRow[] | null) ?? []).map((repreneur) => {
    const normalizedEmail = normalizeEmail(repreneur.email)

    return {
      id: repreneur.id,
      name: fullName(repreneur.first_name, repreneur.last_name),
      email: normalizedEmail,
      lifecycleStatus: repreneur.lifecycle_status,
      hasPortalAccess: roleRepreneurIds.has(repreneur.id) || Boolean(normalizedEmail && roleEmails.has(normalizedEmail)),
      visibleOpportunityCount: visibleCountByRepreneur.get(repreneur.id) ?? 0,
    }
  })
}

export async function getStaffPortalPreviewProfile(repreneurId: string): Promise<{
  repreneur: PortalRepreneurProfile | null
}> {
  await requireStaffAccess()

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select(PORTAL_REPRENEUR_PROFILE_SELECT)
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { repreneur: normalizePortalRepreneurProfile(repreneur) }
}

export async function listStaffPortalPreviewOpportunities(repreneurId: string): Promise<{
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityExposure[]
}> {
  await requireStaffAccess()

  const supabase = createAdminClient()
  const repreneur = await getRepreneurProfileById(supabase, repreneurId)
  if (!repreneur) return { repreneur: null, opportunities: [] }

  return {
    repreneur,
    opportunities: await listVisibleOpportunitiesForRepreneur(supabase, repreneur.id),
  }
}

export async function getStaffPortalPreviewOpportunity(
  repreneurId: string,
  matchId: string
): Promise<RepreneurOpportunityExposure | null> {
  await requireStaffAccess()
  if (!isUuid(repreneurId) || !isUuid(matchId)) return null

  const supabase = createAdminClient()
  const opportunities = await listVisibleOpportunitiesForRepreneur(supabase, repreneurId, matchId)
  return opportunities[0] ?? null
}
