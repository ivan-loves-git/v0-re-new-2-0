"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityMatchRecommendation,
  OpportunityMatchResponse,
  OpportunityMatchStatus,
} from "@/lib/types/opportunity"

function readString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(formData: FormData, key: string): number | null {
  const value = readString(formData, key)
  if (!value) return null
  const normalized = value.replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function readRecommendation(formData: FormData, key: string): OpportunityMatchRecommendation {
  return (readString(formData, key) as OpportunityMatchRecommendation | null) ?? "not_evaluated"
}

function readStatus(formData: FormData): OpportunityMatchStatus {
  return (readString(formData, "status") as OpportunityMatchStatus | null) ?? "draft"
}

function readReasons(formData: FormData): string[] {
  const value = readString(formData, "platform_reasons")
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((reason) => reason.trim())
    .filter(Boolean)
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
    throw new Error("Use Validate pursuit instead of manually saving Active pursuit.")
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
    throw new Error("This opportunity already has an active pursuit. Drop it before exposing the opportunity to another repreneur.")
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
    throw new Error("This repreneur is already the active pursuit. Drop the pursuit before changing this recommendation.")
  }
}

function revalidateMatchPaths(opportunityId: string, matchId?: string) {
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/portal/deals")
  if (matchId) revalidatePath(`/portal/deals/${matchId}`)
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

export async function listOpportunityMatchCandidates(): Promise<OpportunityMatchCandidate[]> {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score")
    .not("lifecycle_status", "in", "(rejected,declined)")
    .order("updated_at", { ascending: false })
    .limit(250)

  if (error) throw new Error(error.message)
  return (data ?? []) as OpportunityMatchCandidate[]
}

export async function saveOpportunityMatch(formData: FormData) {
  const access = await requireStaffAccess()
  const opportunityId = readString(formData, "opportunity_id")
  const repreneurId = readString(formData, "repreneur_id")

  if (!opportunityId) throw new Error("Opportunity is required")
  if (!repreneurId) throw new Error("Repreneur is required")

  const status = readStatus(formData)
  ensureStaffMatchStatus(status)
  await ensureExistingMatchCanBeSaved(opportunityId, repreneurId)
  await ensureOpportunityCanExposeMoreMatches(opportunityId, status)

  const humanRecommendation = readRecommendation(formData, "human_recommendation")
  const humanNotes = readString(formData, "human_notes")
  const hasHumanReview = humanRecommendation !== "not_evaluated" || Boolean(humanNotes)

  const supabase = createAdminClient()
  const { error } = await supabase.from("opportunity_matches").upsert(
    {
      opportunity_id: opportunityId,
      repreneur_id: repreneurId,
      status,
      platform_recommendation: readRecommendation(formData, "platform_recommendation"),
      platform_score: readNumber(formData, "platform_score"),
      platform_reasons: readReasons(formData),
      human_recommendation: humanRecommendation,
      human_notes: humanNotes,
      created_by: access.user.id,
      reviewed_by: hasHumanReview ? access.user.id : null,
      reviewed_at: hasHumanReview ? new Date().toISOString() : null,
    },
    { onConflict: "opportunity_id,repreneur_id" }
  )

  if (error) throw new Error(error.message)
  revalidatePath(`/opportunities/${opportunityId}`)
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
    .select("id, opportunity_id, status")
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

  revalidateMatchPaths(opportunityId, matchId)
}

export async function dropOpportunityPursuit(matchId: string, opportunityId: string) {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      status: "dropped",
      reviewed_by: access.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("opportunity_id", opportunityId)
    .eq("status", "active_pursuit")
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Only an active pursuit can be dropped.")

  revalidateMatchPaths(opportunityId, matchId)
}

export async function reopenDroppedOpportunityMatch(matchId: string, opportunityId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .update({
      status: "interested",
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
