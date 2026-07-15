"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
import {
  sortRepreneurDealFlow,
  type RepreneurDealFlowSortCandidate,
  type RepreneurDealSort,
} from "@/lib/utils/repreneur-deal-flow"
import type {
  OpportunityDeclineReasonCategory,
  OpportunityMatchStatus,
  RepreneurDealFlowOpportunity,
  RepreneurOpportunityDocument,
  RepreneurOpportunityExposure,
  RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"

const VISIBLE_MATCH_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined", "active_pursuit"]
const REPRENEUR_RESPONSE_ALLOWED_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined"]
const DECLINE_REASON_CATEGORIES = new Set<OpportunityDeclineReasonCategory>([
  "geography",
  "sector",
  "size_metrics",
  "business_model",
  "other",
])

type RepreneurDealFlowProfile = RepreneurOpportunityProfile & {
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  q12_geo_zones?: string | string[] | null
  q13_target_sectors_v2?: string | string[] | null
  q14_deal_size?: string | string[] | null
  sector_preferences?: string | string[] | null
  target_location?: string | string[] | null
  target_acquisition_size?: string | null
  investment_capacity?: string | null
}

type RepreneurDealFlowOpportunityRow = {
  id: string
  reference: string
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
  updated_at: string
}

function normalizeProfile(row: any): RepreneurOpportunityProfile {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
  }
}

function normalizeExposure(row: any): RepreneurOpportunityExposure | null {
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
    reference: opportunity.reference,
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
    decline_reason_categories: Array.isArray(row.decline_reason_categories)
      ? row.decline_reason_categories.filter((reason: unknown): reason is OpportunityDeclineReasonCategory =>
          typeof reason === "string" && DECLINE_REASON_CATEGORIES.has(reason as OpportunityDeclineReasonCategory)
        )
      : [],
    decline_reason_text: row.decline_reason_text,
    updated_at: row.updated_at,
  }
}

function readDeclineReasonCategories(formData?: FormData): OpportunityDeclineReasonCategory[] {
  if (!formData) return []
  return formData
    .getAll("decline_reason_categories")
    .filter((value): value is OpportunityDeclineReasonCategory =>
      typeof value === "string" && DECLINE_REASON_CATEGORIES.has(value as OpportunityDeclineReasonCategory)
    )
}

function readDeclineReasonText(formData?: FormData) {
  if (!formData) return null
  const value = formData.get("decline_reason_text")
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

async function getCurrentRepreneurProfile(): Promise<RepreneurOpportunityProfile | null> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null

  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .eq("id", access.repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return profile ? normalizeProfile(profile) : null
}

async function getCurrentRepreneurDealFlowProfile(): Promise<RepreneurDealFlowProfile | null> {
  const access = await requirePortalAccess()
  if (!access.repreneurId) return null

  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from("repreneurs")
    .select(`
      id,
      first_name,
      last_name,
      email,
      who_score,
      when_score,
      scoring_flags,
      q12_geo_zones,
      q13_target_sectors_v2,
      q14_deal_size,
      sector_preferences,
      target_location,
      target_acquisition_size,
      investment_capacity
    `)
    .eq("id", access.repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return profile ? (profile as RepreneurDealFlowProfile) : null
}

function withStaffRecommendation(
  opportunity: RepreneurOpportunityExposure,
): RepreneurDealFlowOpportunity {
  return {
    ...opportunity,
    is_staff_recommended: true,
    is_outside_current_criteria: false,
  }
}

function toDealFlowOpportunity(
  opportunity: RepreneurDealFlowOpportunityRow,
  repreneur: RepreneurDealFlowProfile,
): RepreneurDealFlowSortCandidate {
  const relevance = calculateOpportunityMatchScore(repreneur, opportunity)

  return {
    match_id: null,
    match_status: null,
    visible_documents: [],
    opportunity_id: opportunity.id,
    reference: opportunity.reference,
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
    updated_at: opportunity.updated_at,
    is_staff_recommended: false,
    is_outside_current_criteria: relevance.recommendation === "not_fit",
    relevance_grade: relevance.recommendation,
    relevance_score: relevance.score,
  }
}

function withoutRelevanceScore(opportunity: RepreneurDealFlowSortCandidate): RepreneurDealFlowOpportunity {
  return {
    match_id: opportunity.match_id,
    match_status: opportunity.match_status,
    pursuit_stage: opportunity.pursuit_stage,
    pursuit_stage_updated_at: opportunity.pursuit_stage_updated_at,
    nda_status: opportunity.nda_status,
    nda_updated_at: opportunity.nda_updated_at,
    visible_documents: opportunity.visible_documents,
    opportunity_id: opportunity.opportunity_id,
    reference: opportunity.reference,
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
    decline_reason_categories: opportunity.decline_reason_categories,
    decline_reason_text: opportunity.decline_reason_text,
    updated_at: opportunity.updated_at,
    is_staff_recommended: opportunity.is_staff_recommended,
    is_outside_current_criteria: opportunity.is_outside_current_criteria,
    relevance_grade: opportunity.relevance_grade,
  }
}

export async function listMyRepreneurOpportunities(): Promise<{
  repreneur: RepreneurOpportunityProfile | null
  opportunities: RepreneurOpportunityExposure[]
}> {
  const repreneur = await getCurrentRepreneurProfile()
  if (!repreneur) return { repreneur: null, opportunities: [] }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      status,
      decline_reason_categories,
      decline_reason_text,
      pursuit_stage,
      pursuit_stage_updated_at,
      nda_status,
      nda_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
        reference,
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
    .eq("repreneur_id", repreneur.id)
    .in("status", VISIBLE_MATCH_STATUSES)
    .order("updated_at", { ascending: false })

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

  return {
    repreneur,
    opportunities: opportunities
      .filter((opportunity) => isVisibleUnderActiveLock(opportunity, repreneur.id, activeOwnerByOpportunity))
      .map((opportunity) => ({
        ...opportunity,
        visible_documents:
          opportunity.match_status === "active_pursuit" ? documentsByOpportunity.get(opportunity.opportunity_id) ?? [] : [],
      })),
  }
}

export async function listMyRepreneurDealFlow(sort: RepreneurDealSort): Promise<{
  repreneur: RepreneurOpportunityProfile | null
  staffRecommended: RepreneurDealFlowOpportunity[]
  dealFlow: RepreneurDealFlowOpportunity[]
}> {
  const repreneur = await getCurrentRepreneurDealFlowProfile()
  if (!repreneur) return { repreneur: null, staffRecommended: [], dealFlow: [] }

  const supabase = createAdminClient()
  const [matchesResult, opportunitiesResult] = await Promise.all([
    supabase
      .from("opportunity_matches")
      .select(`
        id,
        status,
        decline_reason_categories,
        decline_reason_text,
        pursuit_stage,
        pursuit_stage_updated_at,
        nda_status,
        nda_updated_at,
        updated_at,
        opportunity:opportunities(
          id,
          reference,
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
      .eq("repreneur_id", repreneur.id)
      .in("status", VISIBLE_MATCH_STATUSES)
      .order("updated_at", { ascending: false }),
    supabase
      .from("opportunities")
      .select(`
        id,
        reference,
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
        date_added,
        updated_at
      `)
      .eq("status", "active")
      .neq("repreneur_exposure", "staff_only"),
  ])

  if (matchesResult.error) throw new Error(matchesResult.error.message)
  if (opportunitiesResult.error) throw new Error(opportunitiesResult.error.message)

  const matchedOpportunities = (matchesResult.data ?? [])
    .map(normalizeExposure)
    .filter((opportunity): opportunity is RepreneurOpportunityExposure => Boolean(opportunity))
  const allOpportunities = opportunitiesResult.data ?? []
  const activeOwnerByOpportunity = await getActivePursuitOwners(
    supabase,
    allOpportunities.map((opportunity) => opportunity.id),
  )
  const documentsByOpportunity = await listApprovedDocumentsByOpportunity(
    supabase,
    matchedOpportunities.map((opportunity) => opportunity.opportunity_id),
  )

  const staffRecommended = matchedOpportunities
    .filter((opportunity) => isVisibleUnderActiveLock(opportunity, repreneur.id, activeOwnerByOpportunity))
    .map((opportunity) => ({
      ...opportunity,
      visible_documents:
        opportunity.match_status === "active_pursuit"
          ? documentsByOpportunity.get(opportunity.opportunity_id) ?? []
          : [],
    }))
    .map(withStaffRecommendation)
  const recommendedOpportunityIds = new Set(staffRecommended.map((opportunity) => opportunity.opportunity_id))
  const dealFlow = sortRepreneurDealFlow(
    allOpportunities
      .filter((opportunity) => !recommendedOpportunityIds.has(opportunity.id))
      .filter((opportunity) => !activeOwnerByOpportunity.has(opportunity.id))
      .map((opportunity) => toDealFlowOpportunity(opportunity, repreneur)),
    sort,
  ).map(withoutRelevanceScore)

  return {
    repreneur,
    staffRecommended,
    dealFlow,
  }
}

export async function getMyRepreneurOpportunity(matchId: string): Promise<RepreneurOpportunityExposure | null> {
  const repreneur = await getCurrentRepreneurProfile()
  if (!repreneur) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      status,
      decline_reason_categories,
      decline_reason_text,
      pursuit_stage,
      pursuit_stage_updated_at,
      nda_status,
      nda_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
        reference,
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
    .eq("id", matchId)
    .eq("repreneur_id", repreneur.id)
    .in("status", VISIBLE_MATCH_STATUSES)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const exposure = data ? normalizeExposure(data) : null
  if (!exposure) return null

  const activeOwnerByOpportunity = await getActivePursuitOwners(supabase, [exposure.opportunity_id])
  if (!isVisibleUnderActiveLock(exposure, repreneur.id, activeOwnerByOpportunity)) return null

  const documentsByOpportunity = await listApprovedDocumentsByOpportunity(supabase, [exposure.opportunity_id])
  return {
    ...exposure,
    visible_documents:
      exposure.match_status === "active_pursuit" ? documentsByOpportunity.get(exposure.opportunity_id) ?? [] : [],
  }
}

async function updateMyOpportunityResponse(matchId: string, status: "interested" | "declined", formData?: FormData) {
  const access = await requirePortalAccess()
  if (!access.repreneurId) throw new Error("No linked repreneur profile")

  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id, status")
    .eq("id", matchId)
    .eq("repreneur_id", access.repreneurId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  if (!match) throw new Error("Opportunity match not found")
  if (!REPRENEUR_RESPONSE_ALLOWED_STATUSES.includes(match.status as OpportunityMatchStatus)) {
    throw new Error("This opportunity response can no longer be changed")
  }

  const declineReasonCategories = status === "declined" ? readDeclineReasonCategories(formData) : []
  const declineReasonText = status === "declined" ? readDeclineReasonText(formData) : null

  if (status === "declined" && declineReasonCategories.length === 0) {
    throw new Error("Choose at least one reason before marking this opportunity as not a fit.")
  }

  if (status === "declined" && declineReasonCategories.includes("other") && !declineReasonText) {
    throw new Error("Add details when selecting Other.")
  }

  const { error } = await supabase
    .from("opportunity_matches")
    .update({
      status,
      decline_reason_categories: status === "declined" ? declineReasonCategories : null,
      decline_reason_text: status === "declined" ? declineReasonText : null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", matchId)
    .eq("repreneur_id", access.repreneurId)

  if (error) throw new Error(error.message)

  revalidatePath("/portal/deals")
  revalidatePath(`/portal/deals/${matchId}`)
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${match.opportunity_id}`)
  redirect("/portal/deals")
}

export async function markMyOpportunityInterested(matchId: string) {
  await updateMyOpportunityResponse(matchId, "interested")
}

export async function declineMyOpportunity(matchId: string, formData: FormData) {
  await updateMyOpportunityResponse(matchId, "declined", formData)
}
