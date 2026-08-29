"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
import {
  loadMatchingGeographyContext,
  withMatchingGeography,
  withMatchingGeographyTargets,
} from "@/lib/repreneur-opportunity-geography"
import {
  hasInvitedLinkedIdentity,
} from "@/lib/repreneur-matching-eligibility"
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
import type {
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityPursuitEvent,
  RepreneurOpportunityMatch,
  OpportunityMatchRecommendation,
  OpportunityMatchResponse,
  OpportunityMatchStatus,
  RepreneurOpportunityCandidate,
} from "@/lib/types/opportunity"
import {
  OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS,
  OPPORTUNITY_MATCH_STATUS_OPTIONS,
} from "@/lib/types/opportunity"

const MATCH_RECOMMENDATION_VALUES = OPPORTUNITY_MATCH_RECOMMENDATION_OPTIONS.map((option) => option.value)
const STAFF_EDITABLE_MATCH_STATUS_VALUES: OpportunityMatchStatus[] = OPPORTUNITY_MATCH_STATUS_OPTIONS.filter(
  (option) => option.value !== "active_pursuit",
).map((option) => option.value as OpportunityMatchStatus)
const REPRENEUR_MATCHING_INPUT_FIELDS = `
  who_score,
  when_score,
  scoring_flags,
  q12_geo_zones,
  q13_target_sectors_v2,
  q14_deal_size,
  q16_equity,
  sector_preferences,
  target_location,
  target_acquisition_size,
  investment_capacity,
  target_revenue_min_meur,
  target_revenue_max_meur,
  target_ebitda_min_keur,
  target_ebitda_max_keur,
  target_ebitda_margin_min_pct,
  target_staff_size_min,
  target_staff_size_max
`

export type OpportunityMatchActionResult =
  | { ok: true }
  | { ok: false; message: string; field?: string }

class OpportunityMatchFormError extends Error {
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = "OpportunityMatchFormError"
    this.field = field
  }
}

function formError(message: string, field?: string) {
  return new OpportunityMatchFormError(message, field)
}

function actionFailure(error: unknown): OpportunityMatchActionResult {
  if (error instanceof OpportunityMatchFormError) {
    return { ok: false, message: error.message, field: error.field }
  }

  return { ok: false, message: "Opportunity match update failed." }
}

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readRecommendation(formData: FormData, key: string): OpportunityMatchRecommendation {
  const value = readString(formData, key) ?? "not_evaluated"
  if (!MATCH_RECOMMENDATION_VALUES.includes(value as OpportunityMatchRecommendation)) {
    throw formError("Select a valid recommendation.", key)
  }

  return value as OpportunityMatchRecommendation
}

function readStatus(formData: FormData): OpportunityMatchStatus {
  const status = readString(formData, "status") ?? "draft"
  if (!STAFF_EDITABLE_MATCH_STATUS_VALUES.includes(status as OpportunityMatchStatus)) {
    throw formError("Select a valid match status.", "status")
  }

  return status as OpportunityMatchStatus
}

function readExpectedUpdatedAt(formData: FormData): string | null {
  const value = readString(formData, "expected_updated_at")
  if (!value) return null
  if (Number.isNaN(Date.parse(value))) {
    throw formError("This recommendation version is invalid. Refresh and try again.")
  }
  return value
}

function normalizeMatch(row: any): OpportunityMatch {
  const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
  return {
    ...row,
    platform_reasons: Array.isArray(row.platform_reasons) ? row.platform_reasons : [],
    repreneur: repreneur ?? null,
  } as OpportunityMatch
}

function normalizeResponse(row: any): OpportunityMatchResponse {
  const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
  const opportunity = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity
  return {
    ...row,
    opportunity: opportunity ?? null,
    repreneur: repreneur ?? null,
  } as OpportunityMatchResponse
}

function normalizeRepreneurMatch(row: Record<string, unknown>): RepreneurOpportunityMatch {
  const opportunity = Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity
  return {
    ...row,
    opportunity: opportunity ?? null,
    platform_reasons: Array.isArray(row.platform_reasons) ? row.platform_reasons : [],
  } as RepreneurOpportunityMatch
}

function normalizePursuitEvent(row: any): OpportunityPursuitEvent {
  const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
  return {
    ...row,
    repreneur: repreneur ?? null,
  } as OpportunityPursuitEvent
}

function repreneurName(repreneur: any): string | null {
  if (!repreneur) return null
  const name = [repreneur.first_name, repreneur.last_name].filter(Boolean).join(" ")
  return name || repreneur.email || null
}

function lockedMatchError(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return formError(
      "This opportunity already has an active pursuit. Drop the current pursuit before validating another repreneur.",
      "status",
    )
  }

  return new Error("Opportunity match update failed.")
}

function ensureStaffMatchStatus(status: OpportunityMatchStatus) {
  if (status === "active_pursuit") {
    throw formError("Use Validate pursuit instead of manually saving Active pursuit.", "status")
  }
}

async function ensureOpportunityCanExposeMoreMatches(opportunityId: string, status: OpportunityMatchStatus) {
  if (status !== "proposed" && status !== "interested") return

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(is_demo)")
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")

  if (error) throw new Error(error.message)
  const hasSameNamespacePursuit = (data ?? []).some((match) => (
    isOpportunityInRepreneurNamespace(
      Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity,
      Array.isArray(match.repreneur) ? match.repreneur[0] : match.repreneur,
    )
  ))
  if (hasSameNamespacePursuit) {
    // Staff cannot expose or alter an external proposal while the opportunity
    // is locked. The only exception is the separate portal-owned response
    // action, which turns an already-proposed candidate into interest.
    throw formError("This opportunity already has an active pursuit. Drop it before exposing the opportunity to another repreneur.", "status")
  }
}

async function ensureOpportunityReadyForExternalMatch(opportunityId: string, status: OpportunityMatchStatus) {
  if (status !== "proposed" && status !== "interested") return
  const { data, error } = await createAdminClient()
    .from("opportunities")
    .select("status")
    .eq("id", opportunityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.status !== "active") throw formError("Only an active opportunity can be proposed externally.", "status")
}

async function ensureExistingMatchCanBeSaved(opportunityId: string, repreneurId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("id, status, updated_at")
    .eq("opportunity_id", opportunityId)
    .eq("repreneur_id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data?.status === "active_pursuit") {
    throw formError("This repreneur is already the active pursuit. Drop the pursuit before changing this recommendation.", "repreneur_id")
  }

  return data as { id: string; status: OpportunityMatchStatus; updated_at: string } | null
}

async function ensureMatchNamespaceAndPortalIdentity(opportunityId: string, repreneurId: string) {
  const supabase = createAdminClient()
  const [
    { data: opportunity, error: opportunityError },
    { data: repreneur, error: repreneurError },
    { data: role, error: roleError },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, is_demo")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("repreneurs")
      .select("id, is_demo")
      .eq("id", repreneurId)
      .maybeSingle(),
    supabase
      .from("app_user_roles")
      .select("role, repreneur_id, user_id")
      .eq("role", "repreneur")
      .eq("repreneur_id", repreneurId)
      .not("user_id", "is", null)
      .maybeSingle(),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (repreneurError) throw new Error(repreneurError.message)
  if (roleError) throw new Error(roleError.message)
  if (
    !opportunity
    || !repreneur
    || typeof opportunity.is_demo !== "boolean"
    || typeof repreneur.is_demo !== "boolean"
    || opportunity.is_demo !== repreneur.is_demo
  ) {
    throw formError("Recommendations must stay inside the same REAL or DEMO data namespace.", "repreneur_id")
  }
  if (!hasInvitedLinkedIdentity(role, repreneurId)) {
    throw formError("Enable portal access for this repreneur before creating a staff recommendation.", "repreneur_id")
  }
}

async function calculateStoredPlatformMatch(opportunityId: string, repreneurId: string) {
  const supabase = createAdminClient()

  const [{ data: opportunity, error: opportunityError }, { data: repreneur, error: repreneurError }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, is_demo, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("repreneurs")
      .select(`id, is_demo, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
      .eq("id", repreneurId)
      .maybeSingle(),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (repreneurError) throw new Error(repreneurError.message)
  if (!opportunity) throw formError("Opportunity was not found.", "opportunity_id")
  if (!repreneur) throw formError("Repreneur was not found.", "repreneur_id")
  if (opportunity.is_demo !== repreneur.is_demo) {
    throw formError("Recommendations must stay inside the same REAL or DEMO data namespace.", "repreneur_id")
  }

  const geography = await loadMatchingGeographyContext(supabase, [repreneur.id])
  return calculateOpportunityMatchScore(
    withMatchingGeographyTargets(repreneur, geography),
    withMatchingGeography(opportunity, geography),
  )
}

function revalidateMatchPaths(opportunityId: string, matchId?: string) {
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/portal/deals")
  if (matchId) revalidatePath(`/portal/deals/${matchId}`)
  revalidateOpportunityDashboardTags()
}

export async function listOpportunityMatches(opportunityId: string): Promise<OpportunityMatch[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("*, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(id, first_name, last_name, email, is_demo, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((row) => isOpportunityInRepreneurNamespace(
      Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity,
      Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
    ))
    .map(normalizeMatch)
}

export async function listOpportunityMatchesForRepreneur(repreneurId: string): Promise<RepreneurOpportunityMatch[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      repreneur_id,
      status,
      pursuit_stage,
      pursuit_stage_updated_at,
      platform_recommendation,
      platform_score,
      platform_reasons,
      human_recommendation,
      human_notes,
      reviewed_at,
      created_at,
      updated_at,
      opportunity:opportunities(
        id,
        is_demo,
        reference,
        public_title,
        sector,
        activity,
        location,
        repreneur_exposure,
        teaser_summary,
        headcount_range,
        internal_notes
      ),
      repreneur:repreneurs!inner(is_demo)
    `)
    .eq("repreneur_id", repreneurId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((row) => isOpportunityInRepreneurNamespace(
      Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity,
      Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
    ))
    .map(normalizeRepreneurMatch)
}

export async function listOpportunityPursuitEvents(opportunityId: string): Promise<OpportunityPursuitEvent[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_pursuit_events")
    .select("*, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(id, first_name, last_name, email, is_demo, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((row) => isOpportunityInRepreneurNamespace(
      Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity,
      Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
    ))
    .map(normalizePursuitEvent)
}

export async function listOpportunityMatchResponses(): Promise<OpportunityMatchResponse[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      repreneur_id,
      status,
      platform_recommendation,
      platform_score,
      human_recommendation,
      human_notes,
      decline_reason_categories,
      decline_reason_text,
      reviewed_by,
      reviewed_at,
      updated_at,
      opportunity:opportunities!inner(id, reference, public_title, sector, location, is_demo),
      repreneur:repreneurs!inner(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score, is_demo)
    `)
    .in("status", ["interested", "declined"])
    .eq("opportunity.is_demo", false)
    .eq("repreneur.is_demo", false)
    .order("reviewed_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)

  const responses = (data ?? []).map(normalizeResponse)
  const opportunityIds = Array.from(new Set(responses.map((response) => response.opportunity_id)))

  if (opportunityIds.length === 0) return responses

  const { data: activeRows, error: activeError } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      repreneur_id,
      repreneur:repreneurs!inner(id, first_name, last_name, email, is_demo)
    `)
    .in("opportunity_id", opportunityIds)
    .eq("status", "active_pursuit")
    .eq("repreneur.is_demo", false)

  if (activeError) throw new Error(activeError.message)

  const activeByOpportunity = new Map<string, OpportunityMatchResponse>()
  for (const row of activeRows ?? []) {
    const repreneur = Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur
    activeByOpportunity.set(row.opportunity_id, {
      active_pursuit_match_id: row.id,
      active_pursuit_repreneur_id: row.repreneur_id,
      active_pursuit_repreneur_name: repreneurName(repreneur),
      active_pursuit_repreneur_email: repreneur?.email ?? null,
    } as OpportunityMatchResponse)
  }

  return responses.map((response) => ({
    ...response,
    ...(activeByOpportunity.get(response.opportunity_id) ?? {}),
  }))
}

export async function listOpportunityMatchCandidates(opportunityId: string): Promise<OpportunityMatchCandidate[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [{ data: opportunity, error: opportunityError }, { data, error }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, is_demo, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("repreneurs")
      .select(`
        id,
        first_name,
        last_name,
        email,
        lifecycle_status,
        is_demo,
        journey_stage,
        recommendation,
        ${REPRENEUR_MATCHING_INPUT_FIELDS}
      `)
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("app_user_roles")
      .select("role, repreneur_id, user_id")
      .eq("role", "repreneur")
      .not("user_id", "is", null),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (error) throw new Error(error.message)
  if (rolesError) throw new Error(rolesError.message)

  const geography = await loadMatchingGeographyContext(
    supabase,
    (data ?? [])
      .filter((candidate) => opportunity && candidate.is_demo === opportunity.is_demo)
      .map((candidate) => candidate.id),
  )
  return (data ?? []).filter((candidate) =>
    opportunity && candidate.is_demo === opportunity.is_demo &&
    (roles ?? []).some((role) => hasInvitedLinkedIdentity(role, candidate.id)),
  ).map((candidate) => {
    if (!opportunity) return candidate as OpportunityMatchCandidate
    const platformMatch = calculateOpportunityMatchScore(
      withMatchingGeographyTargets(candidate, geography),
      withMatchingGeography(opportunity, geography),
    )
    return {
      id: candidate.id,
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
      lifecycle_status: candidate.lifecycle_status,
      journey_stage: candidate.journey_stage,
      recommendation: candidate.recommendation,
      who_score: candidate.who_score,
      when_score: candidate.when_score,
      platform_recommendation: platformMatch.recommendation,
      platform_score: platformMatch.score,
      platform_reasons: platformMatch.reasons,
    } satisfies OpportunityMatchCandidate
  })
}

export async function listOpportunityCandidatesForRepreneur(repreneurId: string): Promise<RepreneurOpportunityCandidate[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const [{ data: repreneur, error: repreneurError }, { data: opportunities, error: opportunitiesError }, { data: existingMatches, error: matchesError }, { data: roles, error: rolesError }] =
    await Promise.all([
      supabase
        .from("repreneurs")
        .select(`id, first_name, last_name, is_demo, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
        .eq("id", repreneurId)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select("id, is_demo, reference, public_title, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id, status, repreneur_exposure")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(250),
      supabase
        .from("opportunity_matches")
        .select("opportunity_id")
        .eq("repreneur_id", repreneurId),
      supabase
        .from("app_user_roles")
        .select("role, repreneur_id, user_id")
        .eq("role", "repreneur")
        .eq("repreneur_id", repreneurId)
        .not("user_id", "is", null),
    ])

  if (repreneurError) throw new Error(repreneurError.message)
  if (opportunitiesError) throw new Error(opportunitiesError.message)
  if (matchesError) throw new Error(matchesError.message)
  if (rolesError) throw new Error(rolesError.message)
  if (!repreneur || !(roles ?? []).some((role) => hasInvitedLinkedIdentity(role, repreneurId))) return []

  const existingOpportunityIds = new Set((existingMatches ?? []).map((match) => match.opportunity_id))
  const geography = await loadMatchingGeographyContext(supabase, [repreneur.id])
  const geographyAwareRepreneur = withMatchingGeographyTargets(repreneur, geography)

  return (opportunities ?? [])
    .filter((opportunity) => (
      opportunity.is_demo === repreneur.is_demo
      && !existingOpportunityIds.has(opportunity.id)
    ))
    .map((opportunity) => {
      const platformMatch = calculateOpportunityMatchScore(
        geographyAwareRepreneur,
        withMatchingGeography(opportunity, geography),
      )
      return {
        id: opportunity.id,
        reference: opportunity.reference,
        public_title: opportunity.public_title,
        sector: opportunity.sector,
        activity: opportunity.activity,
        location: opportunity.location,
        platform_recommendation: platformMatch.recommendation,
        platform_score: platformMatch.score,
        platform_reasons: platformMatch.reasons,
      } satisfies RepreneurOpportunityCandidate
    })
    .sort((a, b) => b.platform_score - a.platform_score)
}

export async function saveOpportunityMatch(formData: FormData): Promise<OpportunityMatchActionResult> {
  const access = await requireStaffAccess()

  try {
    const opportunityId = readString(formData, "opportunity_id")
    const repreneurId = readString(formData, "repreneur_id")

    if (!opportunityId) throw formError("Opportunity is required.")
    if (!repreneurId) throw formError("Select a repreneur before saving.", "repreneur_id")

    const status = readStatus(formData)
    ensureStaffMatchStatus(status)
    const existingMatch = await ensureExistingMatchCanBeSaved(opportunityId, repreneurId)
    const expectedUpdatedAt = readExpectedUpdatedAt(formData)
    if (existingMatch && !expectedUpdatedAt) {
      throw formError("This recommendation was already saved or changed by another staff member. Refresh before editing it again.")
    }
    if (existingMatch && existingMatch.updated_at !== expectedUpdatedAt) {
      throw formError("This recommendation changed while you were editing it. Refresh to see the latest staff notes.")
    }
    await ensureMatchNamespaceAndPortalIdentity(opportunityId, repreneurId)
    await ensureOpportunityReadyForExternalMatch(opportunityId, status)
    await ensureOpportunityCanExposeMoreMatches(opportunityId, status)

    const humanRecommendation = readRecommendation(formData, "human_recommendation")
    const humanNotes = readString(formData, "human_notes")
    const hasHumanReview = humanRecommendation !== "not_evaluated" || Boolean(humanNotes)
    const platformMatch = await calculateStoredPlatformMatch(opportunityId, repreneurId)

    const supabase = createAdminClient()
    const matchValues = {
        opportunity_id: opportunityId,
        repreneur_id: repreneurId,
        status,
        platform_recommendation: platformMatch.recommendation,
        platform_score: platformMatch.score,
        platform_reasons: platformMatch.reasons,
        human_recommendation: humanRecommendation,
        human_notes: humanNotes,
        created_by: access.user.id,
        reviewed_by: hasHumanReview ? access.user.id : null,
        reviewed_at: hasHumanReview ? new Date().toISOString() : null,
      }

    const { data: updatedMatch, error } = existingMatch
      ? await supabase
          .from("opportunity_matches")
          .update(matchValues)
          .eq("id", existingMatch.id)
          .eq("updated_at", expectedUpdatedAt)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("opportunity_matches")
          .insert(matchValues)
          .select("id")
          .maybeSingle()

    if (error?.code === "23505") {
      throw formError("This recommendation was just saved by another staff member. Refresh to see it.")
    }
    if (error) throw lockedMatchError(error)
    if (existingMatch && !updatedMatch) {
      throw formError("This recommendation changed while you were editing it. Refresh to see the latest staff notes.")
    }
    revalidatePath(`/opportunities/${opportunityId}`)
    revalidatePath(`/repreneurs/${repreneurId}`)
    return { ok: true }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function removeOpportunityMatch(matchId: string, opportunityId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, status")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  if (!match) throw new Error("Opportunity match not found")
  if (match.status === "active_pursuit") {
    throw new Error("Drop the active pursuit before removing this recommendation.")
  }

  const { error } = await supabase
    .from("opportunity_matches")
    .delete()
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)

  if (error) throw new Error(error.message)
  revalidatePath(`/opportunities/${opportunityId}`)
}

export async function markOpportunityMatchReviewed(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("opportunity_matches")
    .update({
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)

  if (error) throw new Error(error.message)

  revalidateMatchPaths(opportunityId, matchId)
}

async function pursuitTransitionAlreadyStored(
  supabase: ReturnType<typeof createAdminClient>,
  matchId: string,
  opportunityId: string,
  expected: { status: OpportunityMatchStatus; pursuitStage: string | null },
) {
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("id, status, pursuit_stage")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (error) return false
  return data?.status === expected.status && data.pursuit_stage === expected.pursuitStage
}

export async function validateOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("journey_start_pursuit", {
    p_match_id: matchId, p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_evidence_reference: "staff validation",
  })
  if (error || !data) {
    const alreadyStored = await pursuitTransitionAlreadyStored(
      supabase,
      matchId,
      opportunityId,
      { status: "active_pursuit", pursuitStage: "interest" },
    )
    if (!alreadyStored) {
      throw new Error(error?.message ?? "Only an interested response can be validated into an active pursuit.")
    }
  }

  revalidateMatchPaths(opportunityId, matchId)
}

export async function dropOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("journey_transition_terminal", { p_match_id: matchId, p_transition: "drop", p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_closure_reason: "staff drop" })
  if (error) {
    const alreadyStored = await pursuitTransitionAlreadyStored(
      supabase,
      matchId,
      opportunityId,
      { status: "dropped", pursuitStage: "dropped" },
    )
    if (!alreadyStored) throw new Error(error.message)
  }

  revalidateMatchPaths(opportunityId, matchId)
}

export async function reopenDroppedOpportunityMatch(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("journey_transition_terminal", { p_match_id: matchId, p_transition: "reopen", p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_closure_reason: null })
  if (error) {
    const alreadyStored = await pursuitTransitionAlreadyStored(
      supabase,
      matchId,
      opportunityId,
      { status: "interested", pursuitStage: null },
    )
    if (!alreadyStored) throw new Error(error.message)
  }

  revalidateMatchPaths(opportunityId, matchId)
}

export async function updateOpportunityPursuitStage(matchId: string, opportunityId: string, formData: FormData) {
  await requireStaffAccess()
  void matchId; void opportunityId; void formData
  throw new Error("Legacy pursuit-stage editing is read-only. Record the next canonical journey action instead.")
}

export async function updateOpportunityPursuitNda(matchId: string, opportunityId: string, formData: FormData) {
  await requireStaffAccess()
  void matchId; void opportunityId; void formData
  throw new Error("Legacy NDA status editing is read-only. Use canonical artifact validation and gates instead.")
}
