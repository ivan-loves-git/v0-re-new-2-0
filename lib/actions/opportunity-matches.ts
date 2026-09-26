"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { processRecipientImCleanup } from "@/lib/recipient-im-cleanup"
import { deliverRecommendationAssignment, withAssignmentEmailStatus } from "@/lib/email/recommendation-assignment-delivery"
import { deliverInterestNotification, deliverValidationNotification } from "@/lib/email/interest-notification-delivery"
import { interestRejectionFeedback } from "@/lib/interest-rejection-feedback"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
import {
  loadMatchingGeographyContext,
  withMatchingGeography,
  withMatchingGeographyTargets,
} from "@/lib/repreneur-opportunity-geography"
import {
  manualRecommendationEmail,
} from "@/lib/repreneur-matching-eligibility"
import { isOpportunityInRepreneurNamespace } from "@/lib/repreneur-opportunity-eligibility"
import { withStaffInterestRejections } from "@/lib/data/opportunity-interest-decisions"
import type {
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityPursuitEvent,
  RepreneurOpportunityMatch,
  OpportunityMatchRecommendation,
  OpportunityMatchResponse,
  OpportunityMatchStatus,
  OpportunityPursuitDropReason,
  RepreneurOpportunityCandidate,
} from "@/lib/types/opportunity"
import {
  isOpportunityPursuitDropReason,
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
  | { ok: true; message?: string }
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

async function ensureMatchNamespaceAndEmail(
  opportunityId: string,
  repreneurId: string,
  requireClient: boolean,
) {
  const supabase = createAdminClient()
  const [
    { data: opportunity, error: opportunityError },
    { data: repreneur, error: repreneurError },
  ] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, is_demo")
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("repreneurs")
      .select("id, is_demo, email, lifecycle_status")
      .eq("id", repreneurId)
      .maybeSingle(),
  ])

  if (opportunityError) throw new Error(opportunityError.message)
  if (repreneurError) throw new Error(repreneurError.message)
  if (
    !opportunity
    || !repreneur
    || typeof opportunity.is_demo !== "boolean"
    || typeof repreneur.is_demo !== "boolean"
    || opportunity.is_demo !== repreneur.is_demo
  ) {
    throw formError("Recommendations must stay inside the same REAL or DEMO data namespace.", "repreneur_id")
  }
  if (!manualRecommendationEmail(repreneur.email)) {
    throw formError("Add a valid email to this repreneur before creating a staff recommendation.", "repreneur_id")
  }
  if (requireClient && repreneur.lifecycle_status !== "client") {
    throw formError("Only client repreneurs can receive a new staff recommendation.", "repreneur_id")
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
  const access = await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("*, opportunity:opportunities!inner(is_demo), repreneur:repreneurs!inner(id, first_name, last_name, email, is_demo, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  const matches = (data ?? [])
    .filter((row) => isOpportunityInRepreneurNamespace(
      Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity,
      Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
    ))
    .map(normalizeMatch)
  return withStaffInterestRejections(await withAssignmentEmailStatus(matches, access.user.id), access.user.id)
}

export async function listOpportunityMatchesForRepreneur(repreneurId: string): Promise<RepreneurOpportunityMatch[]> {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      repreneur_id,
      status,
      recommendation_published_at,
      recommendation_expires_at,
      recommendation_renewed_at,
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
  return withAssignmentEmailStatus((data ?? [])
    .filter((row) => isOpportunityInRepreneurNamespace(
      Array.isArray(row.opportunity) ? row.opportunity[0] : row.opportunity,
      Array.isArray(row.repreneur) ? row.repreneur[0] : row.repreneur,
    ))
    .map(normalizeRepreneurMatch), access.user.id)
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
  const access = await requireStaffAccess()
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
      interest_expressed_at,
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

  const withLocks = responses.map((response) => ({
    ...response,
    ...(activeByOpportunity.get(response.opportunity_id) ?? {}),
  }))
  return withStaffInterestRejections(withLocks, access.user.id)
}

export async function listOpportunityMatchCandidates(opportunityId: string): Promise<OpportunityMatchCandidate[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .select("id, is_demo, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id")
    .eq("id", opportunityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!opportunity || typeof opportunity.is_demo !== "boolean") return []

  const candidates: OpportunityMatchCandidate[] = []
  let afterId: string | null = null
  // Keyset pages are complete without an arbitrary latest-updated cap. Score
  // each bounded page so geography filters also stay below URL-size limits.
  while (true) {
    let query = supabase.from("repreneurs")
      .select(`id, first_name, last_name, email, lifecycle_status, is_demo,
        journey_stage, recommendation, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
      .eq("is_demo", opportunity.is_demo)
      .eq("lifecycle_status", "client")
      .order("id", { ascending: true })
      .limit(100)
    if (afterId) query = query.gt("id", afterId)
    const { data: page, error: pageError } = await query
    if (pageError) throw new Error(pageError.message)
    if (!page?.length) break
    const eligible = page.filter(candidate =>
      candidate.lifecycle_status === "client"
      && candidate.is_demo === opportunity.is_demo
      && manualRecommendationEmail(candidate.email),
    )
    const geography = await loadMatchingGeographyContext(supabase, eligible.map(candidate => candidate.id))
    for (const candidate of eligible) {
      const platformMatch = calculateOpportunityMatchScore(
        withMatchingGeographyTargets(candidate, geography),
        withMatchingGeography(opportunity, geography),
      )
      candidates.push({
        id: candidate.id, first_name: candidate.first_name, last_name: candidate.last_name,
        email: candidate.email, lifecycle_status: candidate.lifecycle_status,
        journey_stage: candidate.journey_stage, recommendation: candidate.recommendation,
        who_score: candidate.who_score, when_score: candidate.when_score,
        platform_recommendation: platformMatch.recommendation,
        platform_score: platformMatch.score, platform_reasons: platformMatch.reasons,
      })
    }
    if (page.length < 100) break
    afterId = page[page.length - 1].id
  }
  return candidates
}

export async function listOpportunityCandidatesForRepreneur(repreneurId: string): Promise<RepreneurOpportunityCandidate[]> {
  // This is the staff CRM picker, never a repreneur portal read.
  await requireStaffAccess()
  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase.from("repreneurs")
    .select(`id, first_name, last_name, email, lifecycle_status, is_demo, ${REPRENEUR_MATCHING_INPUT_FIELDS}`)
    .eq("id", repreneurId).maybeSingle()
  if (error) throw new Error(error.message)
  if (
    !repreneur
    || repreneur.lifecycle_status !== "client"
    || typeof repreneur.is_demo !== "boolean"
    || !manualRecommendationEmail(repreneur.email)
  ) return []

  const existingOpportunityIds = new Set<string>()
  let afterMatchId: string | null = null
  while (true) {
    let query = supabase.from("opportunity_matches").select("id, opportunity_id")
      .eq("repreneur_id", repreneurId).order("id", { ascending: true }).limit(100)
    if (afterMatchId) query = query.gt("id", afterMatchId)
    const { data: page, error: pageError } = await query
    if (pageError) throw new Error(pageError.message)
    if (!page?.length) break
    for (const match of page) existingOpportunityIds.add(match.opportunity_id)
    if (page.length < 100) break
    afterMatchId = page[page.length - 1].id
  }

  const geography = await loadMatchingGeographyContext(supabase, [repreneur.id])
  const geographyAwareRepreneur = withMatchingGeographyTargets(repreneur, geography)
  const namespace: boolean = repreneur.is_demo
  const candidates: RepreneurOpportunityCandidate[] = []
  let afterId: string | null = null
  while (true) {
    const query = supabase.from("opportunities")
      .select("id, is_demo, reference, public_title, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id, status, repreneur_exposure")
      .eq("status", "active").eq("is_demo", namespace)
      .order("id", { ascending: true }).limit(100)
    const { data: page, error: pageError } = afterId ? await query.gt("id", afterId) : await query
    if (pageError) throw new Error(pageError.message)
    if (!page?.length) break
    for (const opportunity of page) {
      if (opportunity.is_demo !== repreneur.is_demo || existingOpportunityIds.has(opportunity.id)) continue
      const platformMatch = calculateOpportunityMatchScore(
        geographyAwareRepreneur, withMatchingGeography(opportunity, geography),
      )
      candidates.push({
        id: opportunity.id, reference: opportunity.reference, public_title: opportunity.public_title,
        sector: opportunity.sector, activity: opportunity.activity, location: opportunity.location,
        platform_recommendation: platformMatch.recommendation,
        platform_score: platformMatch.score, platform_reasons: platformMatch.reasons,
      })
    }
    if (page.length < 100) break
    const nextOpportunityId: string = page[page.length - 1].id
    afterId = nextOpportunityId
  }
  return candidates.sort((a, b) => b.platform_score - a.platform_score)
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
    await ensureMatchNamespaceAndEmail(opportunityId, repreneurId, !existingMatch)
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
    if (!existingMatch && updatedMatch && status === "proposed") {
      const notification = await deliverRecommendationAssignment(updatedMatch.id, access.user.id)
      return { ok: true, message: notification.message }
    }
    return { ok: true }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function removeOpportunityMatch(
  matchId: string, opportunityId: string,
): Promise<OpportunityMatchActionResult> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, status")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (matchError) return { ok: false, message: "Could not check this recommendation. Try again." }
  if (!match) return { ok: false, message: "This recommendation no longer exists. Refresh the page." }
  if (match.status === "active_pursuit") {
    return { ok: false, message: "Drop the active pursuit before removing this recommendation." }
  }

  const { error } = await supabase
    .from("opportunity_matches")
    .delete()
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)

  if (error?.code === "P0001" && error.message.includes("recommendation_cycle_delivery_in_flight")) {
    return { ok: false, message: "A recommendation email is being delivered. Wait for it to finish, then try again." }
  }
  if (error?.code === "P0001" && error.message.includes("recommendation_cycle_delivery_review_required")) {
    return { ok: false, message: "A recommendation email has an unresolved delivery outcome. Ask operations to review it before removing this match." }
  }
  if (error) return { ok: false, message: "Recommendation removal failed. Try again." }
  revalidatePath(`/opportunities/${opportunityId}`)
  return { ok: true }
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

export async function validateOpportunityPursuit(
  matchId: string,
  opportunityId: string,
  expectedInterestAt: string | null,
  expectedUpdatedAt: string,
) {
  const access = await requireStaffAccess()
  if (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))
    || (expectedInterestAt !== null && Number.isNaN(Date.parse(expectedInterestAt)))) {
    throw new Error("This exact interest is no longer awaiting validation. Refresh and review its current decision.")
  }
  const supabase = createAdminClient()
  const args = {
    p_match_id: matchId, p_opportunity_id: opportunityId, p_actor: access.user.email,
    p_expected_interest_at: expectedInterestAt,
    p_expected_updated_at: expectedUpdatedAt,
    p_idempotency_key: `w173-validate:${matchId}:${expectedInterestAt ?? "legacy"}:${expectedUpdatedAt}`,
  }
  const attempt = () => supabase.rpc("w173_validate_exact_interest", args)
  let result: Awaited<ReturnType<typeof attempt>> | undefined
  try { result = await attempt() } catch { /* Exact-key retry resolves lost response after commit. */ }
  if (!result?.data) {
    try { result = await attempt() } catch { /* Report unconfirmed outcome below. */ }
  }
  if (!result?.data) throw new Error(result?.error?.message ?? "This exact interest is no longer awaiting validation. Refresh and review its current decision.")

  await deliverValidationNotification(String(result.data)).catch(() => "failed")
  revalidateMatchPaths(opportunityId, matchId)
}

export async function rejectOpportunityInterest(
  matchId: string,
  opportunityId: string,
  expectedInterestAt: string | null,
  expectedUpdatedAt: string,
  reason: string,
): Promise<OpportunityMatchActionResult> {
  const access = await requireStaffAccess()
  const trimmed = reason.trim()
  if (!trimmed || trimmed.length > 500) {
    return { ok: false, message: "Write a short internal reason (maximum 500 characters)." }
  }
  const supabase = createAdminClient()
  const { data: match, error: matchError } = await supabase.from("opportunity_matches")
    .select("opportunity_id")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()
  if (matchError || !match) return { ok: false, message: "This interest is no longer available. Refresh and try again." }
  const { data: eventId, error } = await supabase.rpc("w173_reject_exact_interest", {
    p_match_id: matchId,
    p_expected_interest_at: expectedInterestAt,
    p_expected_updated_at: expectedUpdatedAt,
    p_actor: access.user.id,
    p_reason: trimmed,
  })
  if (error || !eventId) {
    return { ok: false, message: "This exact interest changed or was already decided. Refresh before taking action." }
  }
  const delivery = await deliverInterestNotification(String(eventId)).catch(() => "failed" as const)
  revalidateMatchPaths(opportunityId, matchId)
  return { ok: true, message: interestRejectionFeedback(delivery) }
}

export async function dropOpportunityPursuit(
  matchId: string,
  opportunityId: string,
  reason: OpportunityPursuitDropReason,
) {
  const access = await requireStaffAccess()
  if (!isOpportunityPursuitDropReason(reason)) {
    throw new Error("Choose why this pursuit is ending.")
  }
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("journey_transition_terminal", { p_match_id: matchId, p_transition: "drop", p_actor: access.user.email, p_idempotency_key: crypto.randomUUID(), p_closure_reason: reason })
  if (error) {
    const alreadyStored = await pursuitTransitionAlreadyStored(
      supabase,
      matchId,
      opportunityId,
      { status: "dropped", pursuitStage: "dropped" },
    )
    if (!alreadyStored) throw new Error(error.message)
  }

  const cleanup = await processRecipientImCleanup({ matchId }).catch(() => null)

  revalidateMatchPaths(opportunityId, matchId)
  return { cleanupPending: cleanup === null || cleanup.failed > 0 || cleanup.remaining > 0 }
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
