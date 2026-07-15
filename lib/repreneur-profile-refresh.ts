import { revalidatePath } from "next/cache"
import { revalidateOpportunityDashboardTags, revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { createAdminClient } from "@/lib/supabase/admin"
import { calculateDualScore } from "@/lib/utils/scoring-v2"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"
import type { WhenAnswers, WhoAnswers } from "@/lib/types/scoring-v2"

type RepreneurMatchRecord = {
  id: string
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  q12_geo_zones?: string[] | null
  q13_target_sectors_v2?: string[] | null
  q14_deal_size?: string[] | null
  q16_equity?: string | null
  sector_preferences?: string[] | null
  target_location?: string[] | null
  target_acquisition_size?: string | null
  investment_capacity?: string | null
  target_revenue_min_meur?: number | string | null
  target_revenue_max_meur?: number | string | null
  target_ebitda_margin_min_pct?: number | string | null
  target_ebitda_margin_max_pct?: number | string | null
  target_staff_size_min?: number | string | null
  target_staff_size_max?: number | string | null
}

type OpportunityRecord = {
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | string | null
  ebitda_keur?: number | string | null
  headcount?: number | string | null
}

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

const MATCHING_FIELDS = `
  id,
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
  target_ebitda_margin_max_pct,
  target_staff_size_min,
  target_staff_size_max
`

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function revalidateRepreneurProfilePaths(repreneurId: string, matchRows: Array<{ id: string; opportunity_id: string }>) {
  revalidatePath("/portal/profile")
  revalidatePath("/portal/deals")
  revalidatePath("/opportunities/reviews")
  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/pipeline")
  revalidatePath("/dashboard_re")

  for (const match of matchRows) {
    revalidatePath(`/portal/deals/${match.id}`)
    revalidatePath(`/opportunities/${match.opportunity_id}`)
  }

  revalidateRepreneurDashboardTags()
  revalidateOpportunityDashboardTags()
}

/**
 * Recomputes stored platform match data without changing the match workflow,
 * human recommendation, or staff-owned status fields.
 */
export async function refreshStoredRepreneurMatches(repreneurId: string) {
  const supabase = createAdminClient()
  const { data: repreneur, error: repreneurError } = await supabase
    .from("repreneurs")
    .select(MATCHING_FIELDS)
    .eq("id", repreneurId)
    .maybeSingle()

  if (repreneurError) throw new Error(repreneurError.message)
  if (!repreneur) return

  const { data: matches, error: matchesError } = await supabase
    .from("opportunity_matches")
    .select(`
      id,
      opportunity_id,
      opportunity:opportunities(
        sector,
        activity,
        location,
        revenue_meur,
        ebitda_keur,
        headcount
      )
    `)
    .eq("repreneur_id", repreneurId)

  if (matchesError) throw new Error(matchesError.message)

  const matchRows = (matches ?? []) as Array<{
    id: string
    opportunity_id: string
    opportunity: OpportunityRecord | OpportunityRecord[] | null
  }>

  await Promise.all(
    matchRows.map(async (match) => {
      const opportunity = Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity
      if (!opportunity) return

      const score = calculateOpportunityMatchScore(repreneur as RepreneurMatchRecord, opportunity)
      const { error } = await supabase
        .from("opportunity_matches")
        .update({
          platform_recommendation: score.recommendation,
          platform_score: score.score,
          platform_reasons: score.reasons,
        })
        .eq("id", match.id)
        .eq("repreneur_id", repreneurId)

      if (error) throw new Error(error.message)
    }),
  )

  revalidateRepreneurProfilePaths(repreneurId, matchRows)
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
  await refreshStoredRepreneurMatches(repreneurId)
}
