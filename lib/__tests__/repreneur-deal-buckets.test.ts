import { describe, expect, it } from "vitest"
import {
  classifyRepreneurDeal,
  partitionRepreneurDealBuckets,
  type RepreneurDealBucketCandidate,
} from "@/lib/repreneur-deal-buckets"

function candidate(overrides: Partial<RepreneurDealBucketCandidate> = {}): RepreneurDealBucketCandidate {
  return {
    opportunityId: "opportunity-1",
    matchId: null,
    matchStatus: null,
    isBroadDiscoveryEligible: true,
    ...overrides,
  }
}

describe("repreneur Deals bucket classifier", () => {
  it.each([
    ["proposed", "recommended"],
    ["interested", "in_progress"],
    ["active_pursuit", "in_progress"],
    ["declined", "declined"],
    ["dropped", "declined"],
  ] as const)("classifies an owned %s match as %s", (matchStatus, bucket) => {
    expect(classifyRepreneurDeal(candidate({ matchId: "match-1", matchStatus }))).toBe(bucket)
  })

  it("puts only non-stateful broad-discovery records in Live Opportunities", () => {
    expect(classifyRepreneurDeal(candidate())).toBe("live")
    expect(classifyRepreneurDeal(candidate({ isBroadDiscoveryEligible: false }))).toBeNull()
    expect(classifyRepreneurDeal(candidate({ matchStatus: "shortlisted" }))).toBeNull()
  })

  it("gives an owned match deterministic precedence over broad discovery", () => {
    expect(classifyRepreneurDeal(candidate({ matchId: "match-1", matchStatus: "declined" }))).toBe("declined")
  })

  it("produces no duplicate opportunity across the four exhaustive buckets", () => {
    const buckets = partitionRepreneurDealBuckets([
      candidate({ opportunityId: "proposed", matchId: "match-proposed", matchStatus: "proposed" }),
      candidate({ opportunityId: "interested", matchId: "match-interested", matchStatus: "interested" }),
      candidate({ opportunityId: "active", matchId: "match-active", matchStatus: "active_pursuit" }),
      candidate({ opportunityId: "dropped", matchId: "match-dropped", matchStatus: "dropped" }),
      candidate({ opportunityId: "live" }),
    ])

    expect(buckets.recommended.map((item) => item.opportunityId)).toEqual(["proposed"])
    expect(buckets.in_progress.map((item) => item.opportunityId)).toEqual(["interested", "active"])
    expect(buckets.declined.map((item) => item.opportunityId)).toEqual(["dropped"])
    expect(buckets.live.map((item) => item.opportunityId)).toEqual(["live"])
  })
})
