import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadMatchScoreDisplay } from "@/lib/match-score-provenance"
import type { OpportunityMatchRecommendation } from "@/lib/types/opportunity"

/** A prior list SELECT supplies human context; these displayed Fit fields all come from one later snapshot. */
export async function withStaffFitFreshness<T extends {
  id: string
  platform_recommendation: OpportunityMatchRecommendation
  platform_score?: number | null
  platform_reasons?: string[]
}>(supabase: SupabaseClient, matches: T[]): Promise<T[]> {
  const result: T[] = []
  for (let index = 0; index < matches.length; index += 4) {
    const batch = matches.slice(index, index + 4)
    const displays = await Promise.all(batch.map(async (match) => {
      try { return await loadMatchScoreDisplay(supabase, match.id) }
      catch { return null }
    }))
    result.push(...batch.map((match, offset) => {
      const display = displays[offset]
      return {
        ...match,
        platform_recommendation: (display?.platform_recommendation ?? match.platform_recommendation) as OpportunityMatchRecommendation,
        platform_score: display ? display.platform_score : match.platform_score,
        platform_reasons: display ? display.platform_reasons : match.platform_reasons,
        platform_freshness: display?.freshness ?? "Unknown",
      }
    }))
  }
  return result
}
