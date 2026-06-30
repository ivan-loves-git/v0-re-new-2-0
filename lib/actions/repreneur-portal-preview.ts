"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { LeadershipAssessment } from "@/lib/types/leadership-assessment"
import type {
  OpportunityDeclineReasonCategory,
  OpportunityMatchStatus,
  RepreneurOpportunityDocument,
  RepreneurOpportunityExposure,
  RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"
import type { Repreneur } from "@/lib/types/repreneur"

const VISIBLE_MATCH_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined", "active_pursuit"]
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
  status: string | null
  repreneur_exposure: string | null
  public_title: string | null
  teaser_summary: string | null
  sector: string | null
  activity: string | null
  location: string | null
  revenue_meur: number | null
  ebitda_keur: number | null
  headcount: number | null
  headcount_range: string | null
  date_added: string | null
}

interface PreviewOpportunityMatchRow {
  id: string
  status: RepreneurOpportunityExposure["match_status"]
  platform_recommendation: RepreneurOpportunityExposure["platform_recommendation"]
  platform_score: number | null
  platform_reasons: unknown
  human_recommendation: RepreneurOpportunityExposure["human_recommendation"]
  decline_reason_categories: unknown
  decline_reason_text: string | null
  pursuit_stage: RepreneurOpportunityExposure["pursuit_stage"]
  pursuit_stage_updated_at: string | null
  nda_status: RepreneurOpportunityExposure["nda_status"]
  nda_updated_at: string | null
  updated_at: string
  opportunity: PreviewOpportunityRow | PreviewOpportunityRow[] | null
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
  if (opportunity.status !== "active") return null
  if (opportunity.repreneur_exposure === "staff_only") return null

  return {
    match_id: row.id,
    match_status: row.status,
    pursuit_stage: row.pursuit_stage,
    pursuit_stage_updated_at: row.pursuit_stage_updated_at,
    nda_status: row.nda_status,
    nda_updated_at: row.nda_updated_at,
    visible_documents: [],
    opportunity_id: opportunity.id,
    public_title: opportunity.public_title,
    teaser_summary: opportunity.teaser_summary,
    sector: opportunity.sector,
    activity: opportunity.activity,
    location: opportunity.location,
    revenue_meur: opportunity.revenue_meur,
    ebitda_keur: opportunity.ebitda_keur,
    headcount: opportunity.headcount,
    headcount_range: opportunity.headcount_range,
    date_added: opportunity.date_added,
    platform_recommendation: row.platform_recommendation,
    platform_score: row.platform_score,
    platform_reasons: Array.isArray(row.platform_reasons) ? row.platform_reasons : [],
    human_recommendation: row.human_recommendation,
    decline_reason_categories: Array.isArray(row.decline_reason_categories)
      ? row.decline_reason_categories.filter((reason: unknown): reason is OpportunityDeclineReasonCategory =>
          typeof reason === "string" && DECLINE_REASON_CATEGORIES.has(reason as OpportunityDeclineReasonCategory)
        )
      : [],
    decline_reason_text: row.decline_reason_text,
    updated_at: row.updated_at,
  }
}

async function listApprovedDocumentsByOpportunity(
  supabase: ReturnType<typeof createAdminClient>,
  opportunityIds: string[]
): Promise<Map<string, RepreneurOpportunityDocument[]>> {
  if (opportunityIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("opportunity_documents")
    .select("id, opportunity_id, title, document_type, file_name, size_bytes, uploaded_at")
    .in("opportunity_id", opportunityIds)
    .eq("visibility", "approved_for_repreneur")
    .order("uploaded_at", { ascending: false })

  if (error) throw new Error(error.message)

  const documentsByOpportunity = new Map<string, RepreneurOpportunityDocument[]>()
  for (const document of data ?? []) {
    const documents = documentsByOpportunity.get(document.opportunity_id) ?? []
    documents.push({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      file_name: document.file_name,
      size_bytes: document.size_bytes,
      uploaded_at: document.uploaded_at,
    } as RepreneurOpportunityDocument)
    documentsByOpportunity.set(document.opportunity_id, documents)
  }

  return documentsByOpportunity
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

function isVisibleUnderActiveLock(
  exposure: RepreneurOpportunityExposure,
  currentRepreneurId: string,
  activeOwnerByOpportunity: Map<string, string>
) {
  const activeOwner = activeOwnerByOpportunity.get(exposure.opportunity_id)
  return !activeOwner || activeOwner === currentRepreneurId
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
      platform_recommendation,
      platform_score,
      platform_reasons,
      human_recommendation,
      decline_reason_categories,
      decline_reason_text,
      pursuit_stage,
      pursuit_stage_updated_at,
      nda_status,
      nda_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
        status,
        repreneur_exposure,
        public_title,
        teaser_summary,
        sector,
        activity,
        location,
        revenue_meur,
        ebitda_keur,
        headcount,
        headcount_range,
        date_added
      )
    `)
    .eq("repreneur_id", repreneurId)
    .in("status", VISIBLE_MATCH_STATUSES)
    .order("updated_at", { ascending: false })

  if (matchId) {
    query = query.eq("id", matchId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const opportunities = (data ?? [])
    .map(normalizeExposure)
    .filter((exposure): exposure is RepreneurOpportunityExposure => Boolean(exposure))

  const activeOwnerByOpportunity = await getActivePursuitOwners(
    supabase,
    opportunities.map((opportunity) => opportunity.opportunity_id)
  )
  const documentsByOpportunity = await listApprovedDocumentsByOpportunity(
    supabase,
    opportunities.map((opportunity) => opportunity.opportunity_id)
  )

  return opportunities
    .filter((opportunity) => isVisibleUnderActiveLock(opportunity, repreneurId, activeOwnerByOpportunity))
    .map((opportunity) => ({
      ...opportunity,
      visible_documents:
        opportunity.match_status === "active_pursuit" ? documentsByOpportunity.get(opportunity.opportunity_id) ?? [] : [],
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
      .select("repreneur_id, status")
      .in("status", VISIBLE_MATCH_STATUSES),
  ])

  if (repreneursResult.error) throw new Error(repreneursResult.error.message)
  if (rolesResult.error && rolesResult.error.code !== "42P01") throw new Error(rolesResult.error.message)
  if (matchesResult.error) throw new Error(matchesResult.error.message)

  const roles = (rolesResult.data as PortalRoleRow[] | null) ?? []
  const roleRepreneurIds = new Set(roles.map((role) => role.repreneur_id).filter(Boolean))
  const roleEmails = new Set(roles.map((role) => normalizeEmail(role.email)).filter(Boolean))
  const visibleCountByRepreneur = new Map<string, number>()

  for (const match of matchesResult.data ?? []) {
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
  repreneur: Repreneur | null
  leadershipAssessment: LeadershipAssessment | null
}> {
  await requireStaffAccess()

  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!repreneur) return { repreneur: null, leadershipAssessment: null }

  const { data: leadershipAssessment, error: assessmentError } = await supabase
    .from("leadership_assessments")
    .select("*")
    .eq("repreneur_id", repreneurId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (assessmentError && assessmentError.code !== "42P01") {
    throw new Error(assessmentError.message)
  }

  return {
    repreneur: repreneur as Repreneur,
    leadershipAssessment: (leadershipAssessment as LeadershipAssessment | null) ?? null,
  }
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

  const supabase = createAdminClient()
  const opportunities = await listVisibleOpportunitiesForRepreneur(supabase, repreneurId, matchId)
  return opportunities[0] ?? null
}
