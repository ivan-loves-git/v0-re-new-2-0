import { revalidatePath } from "next/cache"
import { revalidateOpportunityDashboardTags, revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDualScore } from "@/lib/utils/scoring-v2"
import { refreshStoredRepreneurMatchesWithClient } from "@/lib/repreneur-match-refresh-core"
import type { StoredRepreneurMatchRefreshResult } from "@/lib/repreneur-match-refresh-core"
import type { RepreneurFitSource } from "@/lib/match-source-change"
export type { StoredRepreneurMatchRefreshResult } from "@/lib/repreneur-match-refresh-core"
import type { WhenAnswers, WhoAnswers } from "@/lib/types/scoring-v2"

const SCORING_FIELDS = `
  id,
  q05_status,
  q06_experience,
  q07_leadership,
  q08_crisis,
  q09_investment,
  q10_impact,
  q11_priority_choice,
  q11_project_status,
  q12_geo_zones,
  q13_target_sectors_v2,
  q14_deal_size,
  q15_structure,
  q16_equity,
  ldc_url
`


function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function revalidateRepreneurProfilePaths(repreneurId: string) {
  revalidatePath("/portal/profile")
  revalidatePath("/portal/deals")
  revalidatePath("/opportunities/reviews")
  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/pipeline")
  revalidatePath("/dashboard_re")

  revalidateRepreneurDashboardTags()
  revalidateOpportunityDashboardTags()
}

/**
 * Recomputes stored platform match data without changing the match workflow,
 * human recommendation, or staff-owned status fields.
 */
export async function refreshStoredRepreneurMatches(
  repreneurId: string,
  options: { revalidate?: boolean; previousRepreneur?: RepreneurFitSource } = {},
): Promise<StoredRepreneurMatchRefreshResult> {
  const supabase = createAdminClient()
  const result = await refreshStoredRepreneurMatchesWithClient(supabase, repreneurId, options)
  if (options.revalidate !== false) {
    revalidateRepreneurProfilePaths(repreneurId)
  }
  return result
}

/** A completed profile save is never rolled back by a later Fit refresh miss. */
export async function settleRepreneurFitAfterSave(repreneurId: string, options: { previousRepreneur?: RepreneurFitSource } = {}) {
  try {
    const result = await refreshStoredRepreneurMatches(repreneurId, options)
    return {
      current: result.currentRows,
      notRelevant: result.notRelevantRows,
      refreshed: result.refreshedRows,
      driftSkipped: result.driftSkippedRows,
      failed: result.failedMatchRows.length,
      incomplete: result.incomplete,
    }
  } catch {
    return { current: 0, notRelevant: 0, refreshed: 0, driftSkipped: 0, failed: 1, incomplete: true }
  }
}

/**
 * A Lettre de cadrage can change the WHEN score. Keep that score and the
 * stored match snapshots in sync after a secure document upload.
 */
export async function recalculateRepreneurScoresAndMatches(repreneurId: string) {
  const supabase = createAdminClient()
  const { data: repreneur, error } = await supabase
    .from("repreneurs")
    .select(SCORING_FIELDS)
    .eq("id", repreneurId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!repreneur) throw new Error("Repreneur profile not found")

  const whoAnswers: WhoAnswers = {
    q05: (repreneur.q05_status || "employee") as WhoAnswers["q05"],
    q06: (repreneur.q06_experience || "less_than_10") as WhoAnswers["q06"],
    q07: (repreneur.q07_leadership || "none") as WhoAnswers["q07"],
    q08: (repreneur.q08_crisis || "none") as WhoAnswers["q08"],
    q09: (repreneur.q09_investment || "none") as WhoAnswers["q09"],
    q10: (repreneur.q10_impact || "none") as WhoAnswers["q10"],
  }
  const whenAnswers: WhenAnswers = {
    q11: asStringArray(repreneur.q11_project_status) as WhenAnswers["q11"],
    q12: asStringArray(repreneur.q12_geo_zones),
    q13: asStringArray(repreneur.q13_target_sectors_v2),
    q14: asStringArray(repreneur.q14_deal_size) as WhenAnswers["q14"],
    q15: asStringArray(repreneur.q15_structure) as WhenAnswers["q15"],
    q16: (repreneur.q16_equity || "tbd") as WhenAnswers["q16"],
    q11_priority: (repreneur.q11_priority_choice || null) as WhenAnswers["q11_priority"],
    hasFicheDeCadrage: Boolean(repreneur.ldc_url),
  }
  const score = calculateDualScore(whoAnswers, whenAnswers)

  const { error: updateError } = await supabase
    .from("repreneurs")
    .update({
      who_score: score.who.score,
      when_score: score.when.score,
      who_score_breakdown: score.who.breakdown,
      when_score_breakdown: score.when.breakdown,
      scoring_flags: score.flags.flags,
      recommendation: score.recommendation,
    })
    .eq("id", repreneurId)

  if (updateError) throw new Error(updateError.message)
  // WHO/WHEN qualification and LDC evidence are not Matching 2.2 inputs.
  // Thesis writers explicitly request a guarded Fit refresh after their save.
}
