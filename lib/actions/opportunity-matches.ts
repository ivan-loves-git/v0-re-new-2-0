"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityMatch,
  OpportunityMatchCandidate,
  OpportunityMatchRecommendation,
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

export async function listOpportunityMatches(opportunityId: string): Promise<OpportunityMatch[]> {
  await requireUser()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("*, repreneur:repreneurs(id, first_name, last_name, email, lifecycle_status, journey_stage, recommendation, who_score, when_score)")
    .eq("opportunity_id", opportunityId)
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeMatch)
}

export async function listOpportunityMatchCandidates(): Promise<OpportunityMatchCandidate[]> {
  await requireUser()
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
  const user = await requireUser()
  const opportunityId = readString(formData, "opportunity_id")
  const repreneurId = readString(formData, "repreneur_id")

  if (!opportunityId) throw new Error("Opportunity is required")
  if (!repreneurId) throw new Error("Repreneur is required")

  const humanRecommendation = readRecommendation(formData, "human_recommendation")
  const humanNotes = readString(formData, "human_notes")
  const hasHumanReview = humanRecommendation !== "not_evaluated" || Boolean(humanNotes)

  const supabase = createAdminClient()
  const { error } = await supabase.from("opportunity_matches").upsert(
    {
      opportunity_id: opportunityId,
      repreneur_id: repreneurId,
      status: readStatus(formData),
      platform_recommendation: readRecommendation(formData, "platform_recommendation"),
      platform_score: readNumber(formData, "platform_score"),
      platform_reasons: readReasons(formData),
      human_recommendation: humanRecommendation,
      human_notes: humanNotes,
      created_by: user.id,
      reviewed_by: hasHumanReview ? user.id : null,
      reviewed_at: hasHumanReview ? new Date().toISOString() : null,
    },
    { onConflict: "opportunity_id,repreneur_id" }
  )

  if (error) throw new Error(error.message)
  revalidatePath(`/opportunities/${opportunityId}`)
}

export async function removeOpportunityMatch(matchId: string, opportunityId: string) {
  await requireUser()
  const supabase = createAdminClient()

  const { error } = await supabase.from("opportunity_matches").delete().eq("id", matchId)
  if (error) throw new Error(error.message)
  revalidatePath(`/opportunities/${opportunityId}`)
}
