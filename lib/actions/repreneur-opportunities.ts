"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requirePortalAccess } from "@/lib/access-control"
import { requireUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityMatchStatus,
  RepreneurOpportunityExposure,
  RepreneurOpportunityProfile,
} from "@/lib/types/opportunity"

const VISIBLE_MATCH_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined", "active_pursuit"]
const REPRENEUR_RESPONSE_ALLOWED_STATUSES: OpportunityMatchStatus[] = ["proposed", "interested", "declined"]

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
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
  if (opportunity.repreneur_visibility === "staff_only") return null

  return {
    match_id: row.id,
    match_status: row.status,
    pursuit_stage: row.pursuit_stage,
    pursuit_stage_updated_at: row.pursuit_stage_updated_at,
    opportunity_id: opportunity.id,
    public_title: opportunity.public_title,
    anonymized_description: opportunity.anonymized_description,
    sector: opportunity.sector,
    activity: opportunity.activity,
    location: opportunity.location,
    revenue_meur: opportunity.revenue_meur,
    ebitda_keur: opportunity.ebitda_keur,
    headcount: opportunity.headcount,
    date_added: opportunity.date_added,
    platform_recommendation: row.platform_recommendation,
    platform_score: row.platform_score,
    platform_reasons: Array.isArray(row.platform_reasons) ? row.platform_reasons : [],
    human_recommendation: row.human_recommendation,
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

function isVisibleUnderActiveLock(
  exposure: RepreneurOpportunityExposure,
  currentRepreneurId: string,
  activeOwnerByOpportunity: Map<string, string>
) {
  const activeOwner = activeOwnerByOpportunity.get(exposure.opportunity_id)
  return !activeOwner || activeOwner === currentRepreneurId
}

async function getCurrentRepreneurProfile(): Promise<RepreneurOpportunityProfile | null> {
  const user = await requireUser()
  const email = normalizeEmail(user.email)
  if (!email) return null

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email")
    .ilike("email", email)
    .limit(20)

  if (error) throw new Error(error.message)
  const profile = (data ?? []).find((row) => normalizeEmail(row.email) === email)
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
      pursuit_stage,
      pursuit_stage_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
        status,
        repreneur_visibility,
        public_title,
        anonymized_description,
        sector,
        activity,
        location,
        revenue_meur,
        ebitda_keur,
        headcount,
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

  return {
    repreneur,
    opportunities: opportunities.filter((opportunity) =>
      isVisibleUnderActiveLock(opportunity, repreneur.id, activeOwnerByOpportunity)
    ),
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
      pursuit_stage,
      pursuit_stage_updated_at,
      updated_at,
      opportunity:opportunities(
        id,
        status,
        repreneur_visibility,
        public_title,
        anonymized_description,
        sector,
        activity,
        location,
        revenue_meur,
        ebitda_keur,
        headcount,
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
  return isVisibleUnderActiveLock(exposure, repreneur.id, activeOwnerByOpportunity) ? exposure : null
}

async function updateMyOpportunityResponse(matchId: string, status: "interested" | "declined") {
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

  const { error } = await supabase
    .from("opportunity_matches")
    .update({
      status,
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

export async function declineMyOpportunity(matchId: string) {
  await updateMyOpportunityResponse(matchId, "declined")
}
