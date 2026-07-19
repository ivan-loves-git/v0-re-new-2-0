"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidateOpportunityDashboardTags } from "@/lib/data/dashboard-snapshots"
import { canMarkOpportunityInfoMemoReceived } from "@/lib/opportunity-confidentiality"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
import type {
  OpportunityNdaStatus,
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityPursuitEvent,
  OpportunityPursuitStage,
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

const STAFF_EDITABLE_PURSUIT_STAGES: OpportunityPursuitStage[] = [
  "interest",
  "info_memo_received",
  "intermediary_meeting",
  "seller_meeting",
  "loi",
  "closed",
]
const STAFF_EDITABLE_NDA_STATUSES: OpportunityNdaStatus[] = ["not_required", "required", "sent", "signed", "waived"]
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

function readCheckbox(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === "on" || value === "true"
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

function readPursuitStage(formData: FormData): OpportunityPursuitStage {
  const stage = readString(formData, "pursuit_stage") as OpportunityPursuitStage | null
  if (!stage || !STAFF_EDITABLE_PURSUIT_STAGES.includes(stage)) {
    throw new Error("Select a valid pursuit stage.")
  }

  return stage
}

function readNdaStatus(formData: FormData): OpportunityNdaStatus {
  const status = readString(formData, "nda_status") as OpportunityNdaStatus | null
  if (!status || !STAFF_EDITABLE_NDA_STATUSES.includes(status)) {
    throw new Error("Select a valid NDA status.")
  }

  return status
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
    throw formError("This opportunity already has an active pursuit. Drop it before exposing the opportunity to another repreneur.", "status")
  }
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

async function createPursuitEvent({
  matchId,
  opportunityId,
  repreneurId,
  stage,
  note,
  createdBy,
}: {
  matchId: string
  opportunityId: string
  repreneurId: string
  stage: OpportunityPursuitStage
  note?: string | null
  createdBy?: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from("opportunity_pursuit_events").insert({
    match_id: matchId,
    opportunity_id: opportunityId,
    repreneur_id: repreneurId,
    stage,
    note,
    created_by: createdBy,
  })

  if (error) throw new Error(error.message)
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

  const { data: match, error: matchError } = await supabase
    .from("opportunity_matches")
    .select("id, opportunity_id, repreneur_id, status")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .maybeSingle()

  if (matchError) throw new Error(matchError.message)
  if (!match) throw new Error("Opportunity match not found")
  if (match.status !== "interested") {
    throw new Error("Only an interested response can be validated into an active pursuit.")
  }

  const { data: updatedMatch, error } = await supabase
    .from("opportunity_matches")
    .update({
      status: "active_pursuit",
      pursuit_stage: "interest",
      pursuit_stage_notes: null,
      pursuit_stage_updated_by: access.user.id,
      pursuit_stage_updated_at: new Date().toISOString(),
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "interested")
    .select("id")
    .maybeSingle()

  if (error) throw lockedMatchError(error)
  if (!updatedMatch) throw new Error("Only an interested response can be validated into an active pursuit.")

  await createPursuitEvent({
    matchId,
    opportunityId,
    repreneurId: match.repreneur_id,
    stage: "interest",
    note: "Pursuit validated.",
    createdBy: access.user.id,
  })

  revalidateMatchPaths(opportunityId, matchId)
}

export async function dropOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      status: "dropped",
      pursuit_stage: "dropped",
      pursuit_stage_updated_by: access.user.id,
      pursuit_stage_updated_at: new Date().toISOString(),
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .select("id, repreneur_id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Only an active pursuit can be dropped.")

  await createPursuitEvent({
    matchId,
    opportunityId,
    repreneurId: data.repreneur_id,
    stage: "dropped",
    note: "Pursuit dropped.",
    createdBy: access.user.id,
  })

  revalidateMatchPaths(opportunityId, matchId)
}

export async function reopenDroppedOpportunityMatch(matchId: string, opportunityId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      status: "interested",
      pursuit_stage: null,
      pursuit_stage_notes: null,
      pursuit_stage_updated_by: null,
      pursuit_stage_updated_at: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "dropped")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Only a dropped pursuit can be reopened.")

  revalidateMatchPaths(opportunityId, matchId)
}

export async function updateOpportunityPursuitStage(matchId: string, opportunityId: string, formData: FormData) {
  const access = await requireStaffAccess()
  const stage = readPursuitStage(formData)
  const note = readString(formData, "pursuit_stage_notes")
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data: activeMatch, error: activeMatchError } = await supabase
    .from("opportunity_matches")
    .select("id, repreneur_id, nda_status")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .maybeSingle()

  if (activeMatchError) throw new Error(activeMatchError.message)
  if (!activeMatch) throw new Error("Only an active pursuit can have its stage updated.")

  if (stage === "info_memo_received") {
    const { data: documents, error: documentsError } = await supabase
      .from("opportunity_documents")
      .select("document_type, visibility, storage_path, external_url")
      .eq("opportunity_id", opportunityId)
      .eq("document_type", "deal_book")
      .eq("visibility", "approved_for_repreneur")

    if (documentsError) throw new Error(documentsError.message)
    const memoAvailable = (documents ?? []).some((document) =>
      canMarkOpportunityInfoMemoReceived(activeMatch.nda_status, document),
    )
    if (!memoAvailable) {
      throw formError(
        "A signed or waived NDA and an approved info memo file are required before marking Info memo received.",
        "pursuit_stage",
      )
    }
  }

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      pursuit_stage: stage,
      pursuit_stage_notes: note,
      pursuit_stage_updated_by: access.user.id,
      pursuit_stage_updated_at: now,
      reviewed_by: access.user.id,
      reviewed_at: now,
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Only an active pursuit can have its stage updated.")

  await createPursuitEvent({
    matchId,
    opportunityId,
    repreneurId: activeMatch.repreneur_id,
    stage,
    note,
    createdBy: access.user.id,
  })

  revalidateMatchPaths(opportunityId, matchId)
}

export async function updateOpportunityPursuitNda(matchId: string, opportunityId: string, formData: FormData) {
  const access = await requireStaffAccess()
  const ndaStatus = readNdaStatus(formData)
  const ndaReceived = readCheckbox(formData, "nda_received")
  const ndaDocumentId = readString(formData, "nda_document_id")
  const ndaNotes = readString(formData, "nda_notes")
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const linkedNdaDocumentId = ndaDocumentId === "none" ? null : ndaDocumentId

  if (linkedNdaDocumentId) {
    const { data: document, error: documentError } = await supabase
      .from("opportunity_documents")
      .select("id")
      .eq("id", linkedNdaDocumentId)
      .eq("opportunity_id", opportunityId)
      .eq("document_type", "nda")
      .maybeSingle()

    if (documentError) throw new Error(documentError.message)
    if (!document) throw new Error("Select an NDA document from this opportunity.")
  }

  const { data: activeMatch, error: activeMatchError } = await supabase
    .from("opportunity_matches")
    .select("id, nda_received_at, nda_signed_at")
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .maybeSingle()

  if (activeMatchError) throw new Error(activeMatchError.message)
  if (!activeMatch) throw new Error("Only an active pursuit can have NDA status updated.")

  const ndaReceivedAt = ndaReceived || ndaStatus === "signed" ? activeMatch.nda_received_at ?? now : null
  const ndaSignedAt = ndaStatus === "signed" ? activeMatch.nda_signed_at ?? now : null

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      nda_status: ndaStatus,
      nda_document_id: linkedNdaDocumentId,
      nda_notes: ndaNotes,
      nda_received_at: ndaReceivedAt,
      nda_signed_at: ndaSignedAt,
      nda_updated_by: access.user.id,
      nda_updated_at: now,
      reviewed_by: access.user.id,
      reviewed_at: now,
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Only an active pursuit can have NDA status updated.")

  revalidateMatchPaths(opportunityId, matchId)
}
