import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OpportunityFitSource } from "@/lib/match-source-change"
import { buildGeographyPaths } from "@/lib/repreneur-opportunity-geography"
import {
  freshnessFromSnapshot,
  getSnapshotScoringInputs,
  loadMatchScoreSnapshot,
  signMatchInputs,
} from "@/lib/match-score-provenance"
import { MATCHING_V2_CONFIG, calculateOpportunityMatchScore, matchingEffectiveInputs } from "@/lib/utils/opportunity-match-scoring"

const PAGE_SIZE = 50
const MAX_PAGES = 20
const WORKERS = 4

export type StoredRepreneurMatchRefreshResult = {
  repreneurId: string
  matchedRows: number
  currentRows: number
  notRelevantRows: number
  refreshedRows: number
  driftSkippedRows: number
  skippedMissingOpportunityRows: number
  failedMatchRows: Array<{ matchId: string; message: string }>
  incomplete: boolean
}

type Scope = { repreneurId: string; opportunityId?: never; previousOpportunity?: never }
  | { opportunityId: string; repreneurId?: never; previousOpportunity?: OpportunityFitSource }

async function refreshOneMatch(supabase: SupabaseClient, matchId: string, scope?: Scope) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = await loadMatchScoreSnapshot(supabase, matchId)
    if (!snapshot || snapshot.repreneur.is_demo !== snapshot.opportunity.is_demo
      || (scope?.repreneurId && snapshot.match.repreneur_id !== scope.repreneurId)
      || (scope?.opportunityId && snapshot.match.opportunity_id !== scope.opportunityId)) return "drift" as const
    if (freshnessFromSnapshot(snapshot) === "Fresh") return "current" as const
    const { repreneur, opportunity } = getSnapshotScoringInputs(snapshot)
    if (scope?.previousOpportunity) {
      const paths = buildGeographyPaths(snapshot.geography_nodes)
      const former = {
        ...opportunity,
        ...scope.previousOpportunity,
        geography_path_stable_keys: scope.previousOpportunity.geography_node_id
          ? paths.get(scope.previousOpportunity.geography_node_id) ?? [] : [],
      }
      if (JSON.stringify(matchingEffectiveInputs(repreneur, former))
        === JSON.stringify(matchingEffectiveInputs(repreneur, opportunity))) return "not-relevant" as const
    }
    const score = calculateOpportunityMatchScore(repreneur, opportunity)
    const { data, error } = await supabase.rpc("match_score_commit_guarded", {
      p_match_id: matchId,
      p_repreneur_revision: snapshot.repreneur.revision,
      p_opportunity_revision: snapshot.opportunity.revision,
      p_match_revision: snapshot.match.revision,
      p_target_revision: snapshot.repreneur.target_revision,
      p_taxonomy_revision: snapshot.taxonomy_revision,
      p_scoring_version: MATCHING_V2_CONFIG.version,
      p_inputs_hmac: signMatchInputs(snapshot),
      p_score: score.score,
      p_recommendation: score.recommendation,
      p_reasons: score.reasons,
    })
    if (error) throw new Error(error.message)
    if (data === "committed") return "refreshed" as const
    if (data !== "conflict") throw new Error("Guarded match commit returned an unknown result")
  }
  return "drift" as const
}

/** Bounded keyset scan; each page uses at most four workers and one CAS retry. */
async function refreshScope(supabase: SupabaseClient, scope: Scope) {
  const key = scope.repreneurId ? "repreneur_id" : "opportunity_id"
  const value = scope.repreneurId ?? scope.opportunityId!
  const result: StoredRepreneurMatchRefreshResult = {
    repreneurId: scope.repreneurId ?? "",
    matchedRows: 0,
    currentRows: 0,
    notRelevantRows: 0,
    refreshedRows: 0,
    driftSkippedRows: 0,
    skippedMissingOpportunityRows: 0,
    failedMatchRows: [],
    incomplete: false,
  }
  let afterId: string | null = null
  for (let pageNumber = 0; pageNumber < MAX_PAGES; pageNumber++) {
    let query = supabase.from("opportunity_matches").select("id")
      .eq(key, value).order("id", { ascending: true }).limit(PAGE_SIZE)
    if (afterId) query = query.gt("id", afterId)
    const { data: page, error } = await query
    if (error) throw new Error(error.message)
    const rows = (page ?? []) as Array<{ id: string }>
    if (!rows.length) return result
    result.matchedRows += rows.length
    for (let start = 0; start < rows.length; start += WORKERS) {
      const batch = rows.slice(start, start + WORKERS)
      const settled = await Promise.allSettled(batch.map((row) => refreshOneMatch(supabase, row.id, scope)))
      settled.forEach((outcome, index) => {
        if (outcome.status === "rejected") {
          result.failedMatchRows.push({
            matchId: batch[index].id,
            message: outcome.reason instanceof Error ? outcome.reason.message : "Match refresh failed",
          })
        } else if (outcome.value === "current") result.currentRows++
        else if (outcome.value === "not-relevant") result.notRelevantRows++
        else if (outcome.value === "refreshed") result.refreshedRows++
        else {
          result.driftSkippedRows++
          result.skippedMissingOpportunityRows++
        }
      })
    }
    if (rows.length < PAGE_SIZE) return result
    afterId = rows[rows.length - 1].id
  }
  const { data: remaining, error: remainingError } = await supabase.from("opportunity_matches")
    .select("id").eq(key, value).gt("id", afterId!).order("id", { ascending: true }).limit(1)
  if (remainingError) throw new Error(remainingError.message)
  result.incomplete = Boolean(remaining?.length)
  return result
}

export async function refreshStoredRepreneurMatchesWithClient(
  supabase: SupabaseClient,
  repreneurId: string,
): Promise<StoredRepreneurMatchRefreshResult> {
  return refreshScope(supabase, { repreneurId })
}

export async function refreshStoredOpportunityMatchesWithClient(
  supabase: SupabaseClient,
  opportunityId: string,
  options: { previousOpportunity?: OpportunityFitSource } = {},
) {
  return refreshScope(supabase, { opportunityId, previousOpportunity: options.previousOpportunity })
}

export async function refreshStoredMatchWithClient(supabase: SupabaseClient, matchId: string) {
  return refreshOneMatch(supabase, matchId)
}
