"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requirePortalAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityDeclineReasonCategory,
  OpportunityMatchStatus,
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

export async function getMyRepreneurOpportunity(matchId: string): Promise<RepreneurOpportunityExposure | null> {
  const repreneur = await getCurrentRepreneurProfile()
  if (!repreneur) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
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
