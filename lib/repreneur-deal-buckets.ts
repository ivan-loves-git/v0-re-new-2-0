import "server-only"

import type { OpportunityMatchStatus, RepreneurDealBucket } from "@/lib/types/opportunity"

export type RepreneurDealBucketCandidate = {
  opportunityId: string
  matchId: string | null
  matchStatus: OpportunityMatchStatus | null
  isBroadDiscoveryEligible: boolean
  recommendationResponseOpen?: boolean
}

/**
 * The only authority for Deals section placement. Callers must first apply the
 * portal eligibility projection; this function deliberately does not broaden
 * visibility or make any confidentiality decision.
 */
export function classifyRepreneurDeal(
  candidate: RepreneurDealBucketCandidate,
): RepreneurDealBucket | null {
  switch (candidate.matchStatus) {
    case "proposed":
      if (!candidate.matchId) return null
      return candidate.recommendationResponseOpen === false ? "live" : "recommended"
    case "interested":
    case "active_pursuit":
      return candidate.matchId ? "in_progress" : null
    case "withdrawn":
      return candidate.matchId && candidate.isBroadDiscoveryEligible ? "live" : null
    case "declined":
    case "dropped":
      return candidate.matchId ? "declined" : null
    case null:
      return candidate.isBroadDiscoveryEligible ? "live" : null
    default:
      return null
  }
}

export function partitionRepreneurDealBuckets<T extends RepreneurDealBucketCandidate>(
  candidates: T[],
): Record<RepreneurDealBucket, T[]> {
  const buckets: Record<RepreneurDealBucket, T[]> = {
    recommended: [],
    declined: [],
    in_progress: [],
    live: [],
  }

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate.opportunityId)) continue
    const bucket = classifyRepreneurDeal(candidate)
    if (!bucket) continue
    seen.add(candidate.opportunityId)
    buckets[bucket].push(candidate)
  }

  return buckets
}
