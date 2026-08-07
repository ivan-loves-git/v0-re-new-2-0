"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
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

  if (error instanceof Error) {
    return { ok: false, message: error.message }
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
    return new Error("This opportunity already has an active pursuit. Drop the current pursuit before validating another repreneur.")
  }

  return new Error(error.message ?? "Opportunity match update failed")
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
    .select("id")
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data) {
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
    .select("status, sector, location, public_title, teaser_summary")
    .eq("id", opportunityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.status !== "active") throw formError("Only an active opportunity can be proposed externally.", "status")
  const missing = [data.sector, data.location, data.public_title, data.teaser_summary]
    .some((value) => typeof value !== "string" || !value.trim())
  if (missing) throw formError("Sector, location, public title and teaser summary are required before an external proposal.", "status")
}

async function ensureExistingMatchCanBeSaved(opportunityId: string, repreneurId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("id, status")
    .eq("opportunity_id", opportunityId)
    .eq("repreneur_id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data?.status === "active_pursuit") {
    throw formError("This repreneur is already the active pursuit. Drop the pursuit before changing this recommendation.", "repreneur_id")
  }
}

async function calculateStoredPlatformMatch(opportunityId: string, repreneurId: string) {
  const supabase = createAdminClient()

  const [{ data: opportunity, error: opportunityError }, { data: repreneur, error: repreneurError }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, sector, activity, location, revenue_meur, ebitda_keur, headcount")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("repreneurs")
      .select(`id, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
      .eq("id", repreneurId)
      .maybeSingle(),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (repreneurError) throw new Error(repreneurError.message)
  if (!opportunity) throw formError("Opportunity was not found.", "opportunity_id")
  if (!repreneur) throw formError("Repreneur was not found.", "repreneur_id")

  return calculateOpportunityMatchScore(repreneur, opportunity)
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
    .select("*, repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeMatch)
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
        reference,
        public_title,
        sector,
        activity,
        location,
        repreneur_exposure,
        teaser_summary,
        headcount_range,
        internal_notes
      )
    `)
    .eq("repreneur_id", repreneurId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeRepreneurMatch)
}

export async function listOpportunityPursuitEvents(opportunityId: string): Promise<OpportunityPursuitEvent[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_pursuit_events")
    .select("*, repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizePursuitEvent)
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
      opportunity:opportunities(id, reference, public_title, sector, location),
      repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)
    `)
    .in("status", ["interested", "declined"])
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
      repreneur:repreneurs(id, first_name, last_name, email)
    `)
    .in("opportunity_id", opportunityIds)
    .eq("status", "active_pursuit")

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

  const [{ data: opportunity, error: opportunityError }, { data, error }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, sector, activity, location, revenue_meur, ebitda_keur, headcount")
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
        journey_stage,
        recommendation,
        ${REPRENEUR_MATCHING_INPUT_FIELDS}
      `)
      .not("lifecycle_status", "in", "(rejected,declined)")
      .order("updated_at", { ascending: false })
      .limit(250),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (error) throw new Error(error.message)

  return (data ?? []).map((candidate) => {
    if (!opportunity) return candidate as OpportunityMatchCandidate
    const platformMatch = calculateOpportunityMatchScore(candidate, opportunity)
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

  const [{ data: repreneur, error: repreneurError }, { data: opportunities, error: opportunitiesError }, { data: existingMatches, error: matchesError }] =
    await Promise.all([
      supabase
        .from("repreneurs")
        .select(`id, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
        .eq("id", repreneurId)
        .maybeSingle(),
      supabase
        .from("opportunities")
        .select("id, reference, public_title, sector, activity, location, revenue_meur, ebitda_keur, headcount, status, repreneur_exposure")
        .eq("status", "active")
        .neq("repreneur_exposure", "staff_only")
        .order("updated_at", { ascending: false })
        .limit(250),
      supabase
        .from("opportunity_matches")
        .select("opportunity_id")
        .eq("repreneur_id", repreneurId),
    ])

  if (repreneurError) throw new Error(repreneurError.message)
  if (opportunitiesError) throw new Error(opportunitiesError.message)
  if (matchesError) throw new Error(matchesError.message)
  if (!repreneur) return []

  const existingOpportunityIds = new Set((existingMatches ?? []).map((match) => match.opportunity_id))

  return (opportunities ?? [])
    .filter((opportunity) => !existingOpportunityIds.has(opportunity.id))
    .map((opportunity) => {
      const platformMatch = calculateOpportunityMatchScore(repreneur, opportunity)
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
    await ensureExistingMatchCanBeSaved(opportunityId, repreneurId)
    await ensureOpportunityReadyForExternalMatch(opportunityId, status)
    await ensureOpportunityCanExposeMoreMatches(opportunityId, status)

    const humanRecommendation = readRecommendation(formData, "human_recommendation")
    const humanNotes = readString(formData, "human_notes")
    const hasHumanReview = humanRecommendation !== "not_evaluated" || Boolean(humanNotes)
    const platformMatch = await calculateStoredPlatformMatch(opportunityId, repreneurId)

    const supabase = createAdminClient()
    const { error } = await supabase.from("opportunity_matches").upsert(
      {
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
      },
      { onConflict: "opportunity_id,repreneur_id" },
    )

    if (error) throw lockedMatchError(error)
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

export async function validateOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc("journey_start_pursuit", {
    p_match_id: matchId, p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_evidence_reference: "staff validation",
  })
  if (error || !data) throw new Error(error?.message ?? "Only an interested response can be validated into an active pursuit.")

  revalidateMatchPaths(opportunityId, matchId)
}

export async function dropOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("journey_transition_terminal", { p_match_id: matchId, p_transition: "drop", p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_closure_reason: "staff drop" })
  if (error) throw new Error(error.message)

  revalidateMatchPaths(opportunityId, matchId)
}

export async function reopenDroppedOpportunityMatch(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("journey_transition_terminal", { p_match_id: matchId, p_transition: "reopen", p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_closure_reason: null })
  if (error) throw new Error(error.message)

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
