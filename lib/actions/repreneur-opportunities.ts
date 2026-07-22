import "server-only"

import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { listLockedOpportunityInterestStateByMatch } from "@/lib/data/locked-opportunity-interest-state"
import {
  canAccessOpportunityMemo,
  safeRepreneurTeaserSummary,
  type OpportunityNdaDisclosureEvidence,
} from "@/lib/opportunity-confidentiality"
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
  description: string | null
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

type PortalMemoDocument = RepreneurOpportunityDocument & {
  visibility: "approved_for_repreneur"
  storage_path: string | null
  external_url: string | null
  repreneur_approved_at: string | null
  repreneur_approved_by: string | null
}

type PortalExposureRecord = {
  exposure: RepreneurOpportunityExposure
  ndaEvidence: OpportunityNdaDisclosureEvidence
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

function normalizeExposureWithDisclosure(
  row: OpportunityNdaDisclosureEvidence,
): PortalExposureRecord | null {
  const exposure = normalizeExposure(row)
  if (!exposure) return null

  return {
    exposure,
    ndaEvidence: {
      nda_status: row.nda_status,
      nda_signed_at: row.nda_signed_at,
      nda_waived_at: row.nda_waived_at,
      nda_waived_by: row.nda_waived_by,
    },
  }
}

async function listApprovedMemoDocumentsByOpportunity(
  supabase: ReturnType<typeof createAdminClient>,
  opportunityIds: string[]
): Promise<Map<string, PortalMemoDocument[]>> {
  if (opportunityIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("opportunity_documents")
    .select("id, opportunity_id, title, document_type, file_name, size_bytes, uploaded_at, visibility, storage_path, external_url, repreneur_approved_at, repreneur_approved_by")
    .in("opportunity_id", opportunityIds)
    .eq("document_type", "deal_book")
    .eq("visibility", "approved_for_repreneur")
    .order("uploaded_at", { ascending: false })

  if (error) throw new Error(error.message)

  const documentsByOpportunity = new Map<string, PortalMemoDocument[]>()
  for (const document of data ?? []) {
    const documents = documentsByOpportunity.get(document.opportunity_id) ?? []
    documents.push({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      file_name: document.file_name,
      size_bytes: document.size_bytes,
      uploaded_at: document.uploaded_at,
      visibility: document.visibility,
      storage_path: document.storage_path,
      external_url: document.external_url,
      repreneur_approved_at: document.repreneur_approved_at,
      repreneur_approved_by: document.repreneur_approved_by,
    } as PortalMemoDocument)
    documentsByOpportunity.set(document.opportunity_id, documents)
  }

  return documentsByOpportunity
}

function visibleMemoDocumentsForMatch(
  opportunity: RepreneurOpportunityExposure,
  ndaEvidence: OpportunityNdaDisclosureEvidence,
  documents: PortalMemoDocument[] | undefined,
): RepreneurOpportunityDocument[] {
  if (opportunity.match_status !== "active_pursuit") return []

  return (documents ?? [])
    .filter((document) => canAccessOpportunityMemo(ndaEvidence, document))
    .map((document) => ({
      id: document.id,
      title: document.title,
      document_type: document.document_type,
      file_name: document.file_name,
      size_bytes: document.size_bytes,
      uploaded_at: document.uploaded_at,
    }))
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
    interest_expressed_at: opportunity.interest_expressed_at,
    interest_notification_sent_at: opportunity.interest_notification_sent_at,
    updated_at: opportunity.updated_at,
    is_staff_recommended: opportunity.is_staff_recommended,
    is_outside_current_criteria: opportunity.is_outside_current_criteria,
    relevance_grade: opportunity.relevance_grade,
    is_locked_for_other_repreneur: opportunity.is_locked_for_other_repreneur,
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
      nda_signed_at,
      nda_waived_at,
      nda_waived_by,
      nda_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
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
        date_added
      )
    `)
    .eq("repreneur_id", repreneur.id)
    .in("status", VISIBLE_MATCH_STATUSES)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)

  const exposureRecords = (data ?? [])
    .map(normalizeExposureWithDisclosure)
    .filter((record): record is PortalExposureRecord => Boolean(record))
  const opportunities = exposureRecords.map((record) => record.exposure)

  const activeOwnerByOpportunity = await getActivePursuitOwners(
    supabase,
    opportunities.map((opportunity) => opportunity.opportunity_id)
  )
  const documentsByOpportunity = await listApprovedMemoDocumentsByOpportunity(
    supabase,
    opportunities.map((opportunity) => opportunity.opportunity_id)
  )
  const interestStateByMatch = await listLockedOpportunityInterestStateByMatch(
    supabase,
    opportunities.map((opportunity) => opportunity.match_id),
  )

  return {
    repreneur,
    opportunities: exposureRecords
      .map(({ exposure, ndaEvidence }) => ({
        ...exposure,
        ...interestStateByMatch.get(exposure.match_id),
        is_locked_for_other_repreneur: isLockedForOtherRepreneur(
          exposure.opportunity_id,
          repreneur.id,
          activeOwnerByOpportunity,
        ),
        visible_documents: visibleMemoDocumentsForMatch(
          exposure,
          ndaEvidence,
          documentsByOpportunity.get(exposure.opportunity_id),
        ),
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
        nda_signed_at,
        nda_waived_at,
        nda_waived_by,
        nda_updated_at,
        updated_at,
        opportunity:opportunities(
          id,
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
        description,
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

  const matchedExposureRecords = (matchesResult.data ?? [])
    .map(normalizeExposureWithDisclosure)
    .filter((record): record is PortalExposureRecord => Boolean(record))
  const matchedOpportunities = matchedExposureRecords.map((record) => record.exposure)
  const allOpportunities = opportunitiesResult.data ?? []
  const activeOwnerByOpportunity = await getActivePursuitOwners(
    supabase,
    allOpportunities.map((opportunity) => opportunity.id),
  )
  const documentsByOpportunity = await listApprovedMemoDocumentsByOpportunity(
    supabase,
    matchedOpportunities.map((opportunity) => opportunity.opportunity_id),
  )
  const interestStateByMatch = await listLockedOpportunityInterestStateByMatch(
    supabase,
    matchedOpportunities.map((opportunity) => opportunity.match_id),
  )

  const staffRecommended = matchedExposureRecords
    .map(({ exposure, ndaEvidence }) => ({
      ...exposure,
      ...interestStateByMatch.get(exposure.match_id),
      is_locked_for_other_repreneur: isLockedForOtherRepreneur(
        exposure.opportunity_id,
        repreneur.id,
        activeOwnerByOpportunity,
      ),
      visible_documents: visibleMemoDocumentsForMatch(
        exposure,
        ndaEvidence,
        documentsByOpportunity.get(exposure.opportunity_id),
      ),
    }))
    .map(withStaffRecommendation)
  const recommendedOpportunityIds = new Set(staffRecommended.map((opportunity) => opportunity.opportunity_id))
  const dealFlow = sortRepreneurDealFlow(
    allOpportunities
      .filter((opportunity) => !recommendedOpportunityIds.has(opportunity.id))
      .map((opportunity) => ({
        ...toDealFlowOpportunity(opportunity, repreneur),
        is_locked_for_other_repreneur: isLockedForOtherRepreneur(
          opportunity.id,
          repreneur.id,
          activeOwnerByOpportunity,
        ),
      })),
    sort,
  ).map(withoutRelevanceScore)

  return {
    repreneur,
    staffRecommended,
    dealFlow,
  }
}

export async function getMyRepreneurOpportunity(
  dealId: string,
): Promise<RepreneurOpportunityExposure | RepreneurDealFlowOpportunity | null> {
  const repreneur = await getCurrentRepreneurDealFlowProfile()
  if (!repreneur) return null

  const supabase = createAdminClient()
  const [matchResult, opportunityResult] = await Promise.all([
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
        nda_signed_at,
        nda_waived_at,
        nda_waived_by,
        nda_updated_at,
        updated_at,
        opportunity:opportunities(
          id,
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
          date_added
        )
      `)
      .eq("id", dealId)
      .eq("repreneur_id", repreneur.id)
      .in("status", VISIBLE_MATCH_STATUSES)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select(`
        id,
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
        updated_at
      `)
      .eq("id", dealId)
      .eq("status", "active")
      .neq("repreneur_exposure", "staff_only")
      .maybeSingle(),
  ])

  if (matchResult.error) throw new Error(matchResult.error.message)
  if (opportunityResult.error) throw new Error(opportunityResult.error.message)
  const exposure = matchResult.data ? normalizeExposure(matchResult.data) : null
  const ndaEvidence: OpportunityNdaDisclosureEvidence = matchResult.data
    ? {
        nda_status: matchResult.data.nda_status,
        nda_signed_at: matchResult.data.nda_signed_at,
        nda_waived_at: matchResult.data.nda_waived_at,
        nda_waived_by: matchResult.data.nda_waived_by,
      }
    : {}

  if (!exposure) {
    const opportunity = opportunityResult.data as RepreneurDealFlowOpportunityRow | null
    if (!opportunity) return null

    const activeOwnerByOpportunity = await getActivePursuitOwners(supabase, [opportunity.id])
    if (activeOwnerByOpportunity.has(opportunity.id)) return null

    return withoutRelevanceScore(toDealFlowOpportunity(opportunity, repreneur))
  }

  const activeOwnerByOpportunity = await getActivePursuitOwners(supabase, [exposure.opportunity_id])

  const documentsByOpportunity = await listApprovedMemoDocumentsByOpportunity(supabase, [exposure.opportunity_id])
  const interestStateByMatch = await listLockedOpportunityInterestStateByMatch(supabase, [exposure.match_id])
  return {
    ...exposure,
    ...interestStateByMatch.get(exposure.match_id),
    is_locked_for_other_repreneur: isLockedForOtherRepreneur(
      exposure.opportunity_id,
      repreneur.id,
      activeOwnerByOpportunity,
    ),
    visible_documents: visibleMemoDocumentsForMatch(
      exposure,
      ndaEvidence,
      documentsByOpportunity.get(exposure.opportunity_id),
    ),
  }
}
