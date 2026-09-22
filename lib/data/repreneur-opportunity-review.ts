import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { RepreneurPersonalReview } from "@/lib/types/opportunity"

/** Only call after the owning portal profile and visible opportunities are resolved. */
export async function readPersonalOpportunityReviews(
  repreneurId: string,
  isDemo: boolean,
  opportunityIds: string[],
): Promise<Map<string, RepreneurPersonalReview> | null> {
  const result = new Map<string, RepreneurPersonalReview>()
  const ids = [...new Set(opportunityIds)]
  if (!ids.length) return result
  try {
    const supabase = createAdminClient()
    // Bounded IDs avoid response caps silently turning viewed deals into unviewed ones.
    for (let start = 0; start < ids.length; start += 100) {
      const { data, error } = await supabase.from("repreneur_opportunity_review_state")
        .select("opportunity_id, reviewed")
        .eq("repreneur_id", repreneurId).eq("is_demo", isDemo)
        .in("opportunity_id", ids.slice(start, start + 100))
      if (error) return null
      for (const row of data ?? []) {
        result.set(row.opportunity_id, { viewed: true, reviewed: row.reviewed === true })
      }
    }
    return result
  } catch {
    // An unavailable store is unknown, never false evidence of an unopened deal.
    return null
  }
}
