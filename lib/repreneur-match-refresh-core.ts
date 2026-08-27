import type { SupabaseClient } from "@supabase/supabase-js"
import {
  loadMatchingGeographyContext,
  withMatchingGeography,
  withMatchingGeographyTargets,
} from "@/lib/repreneur-opportunity-geography"
import { calculateOpportunityMatchScore } from "@/lib/utils/opportunity-match-scoring"

type RepreneurMatchRecord = {
  id: string
  is_demo?: boolean | null
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
  is_demo?: boolean | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | string | null
  ebitda_keur?: number | string | null
  headcount?: number | string | null
  geography_node_id?: string | null
}

const MATCHING_FIELDS = `
  id,
  is_demo,
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

export type StoredRepreneurMatchRefreshResult = {
  repreneurId: string
  matchedRows: number
  refreshedRows: number
  skippedMissingOpportunityRows: number
  failedMatchRows: Array<{ matchId: string; message: string }>
}

/** Next-independent write primitive for stored scoring snapshots only. */
export async function refreshStoredRepreneurMatchesWithClient(
  supabase: SupabaseClient,
  repreneurId: string,
): Promise<StoredRepreneurMatchRefreshResult> {
  const { data: repreneur, error: repreneurError } = await supabase
    .from("repreneurs")
    .select(MATCHING_FIELDS)
    .eq("id", repreneurId)
    .maybeSingle()
  if (repreneurError) throw new Error(repreneurError.message)
  if (!repreneur) return { repreneurId, matchedRows: 0, refreshedRows: 0, skippedMissingOpportunityRows: 0, failedMatchRows: [] }
  const repreneurIsDemo = (repreneur as RepreneurMatchRecord).is_demo
  if (typeof repreneurIsDemo !== "boolean") return { repreneurId, matchedRows: 0, refreshedRows: 0, skippedMissingOpportunityRows: 0, failedMatchRows: [] }

  const { data: matches, error: matchesError } = await supabase
    .from("opportunity_matches")
    .select(`id, opportunity_id, opportunity:opportunities(is_demo, sector, activity, location, revenue_meur, ebitda_keur, headcount, geography_node_id)`)
    .eq("repreneur_id", repreneurId)
  if (matchesError) throw new Error(matchesError.message)

  const matchRows = (matches ?? []) as Array<{ id: string; opportunity_id: string; opportunity: OpportunityRecord | OpportunityRecord[] | null }>
  const geography = await loadMatchingGeographyContext(supabase, [repreneur.id])
  const geographyAwareRepreneur = withMatchingGeographyTargets(
    repreneur as RepreneurMatchRecord,
    geography,
  )
  const settled = await Promise.allSettled(matchRows.map(async (match) => {
    const opportunity = Array.isArray(match.opportunity) ? match.opportunity[0] : match.opportunity
    if (!opportunity || opportunity.is_demo !== repreneurIsDemo) return "skipped" as const
    const score = calculateOpportunityMatchScore(
      geographyAwareRepreneur,
      withMatchingGeography(opportunity, geography),
    )
    const { error } = await supabase.from("opportunity_matches").update({
      platform_recommendation: score.recommendation,
      platform_score: score.score,
      platform_reasons: score.reasons,
    }).eq("id", match.id).eq("repreneur_id", repreneurId)
    if (error) throw new Error(error.message)
    return "refreshed" as const
  }))
  const failedMatchRows = settled.flatMap((result, index) => result.status === "rejected"
    ? [{ matchId: matchRows[index].id, message: result.reason instanceof Error ? result.reason.message : "refresh failed" }]
    : [])
  return {
    repreneurId,
    matchedRows: matchRows.length,
    refreshedRows: settled.filter((result) => result.status === "fulfilled" && result.value === "refreshed").length,
    skippedMissingOpportunityRows: settled.filter((result) => result.status === "fulfilled" && result.value === "skipped").length,
    failedMatchRows,
  }
}
