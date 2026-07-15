import { describe, expect, it } from "vitest"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"
import { parseRepreneurDealSort, sortRepreneurDealFlow } from "../repreneur-deal-flow"

function opportunity(overrides: Partial<RepreneurDealFlowOpportunity>): RepreneurDealFlowOpportunity {
  return {
    match_id: null,
    match_status: null,
    visible_documents: [],
    opportunity_id: "opportunity",
    platform_recommendation: "possible_fit",
    platform_reasons: [],
    human_recommendation: "not_evaluated",
    updated_at: "2026-07-01T00:00:00.000Z",
    is_staff_recommended: false,
    relevance_grade: "possible_fit",
    relevance_score: 60,
    ...overrides,
  }
}

describe("repreneur deal flow sorting", () => {
  it("defaults stale sort values to relevance", () => {
    expect(parseRepreneurDealSort(undefined)).toBe("relevance")
    expect(parseRepreneurDealSort("unknown")).toBe("relevance")
    expect(parseRepreneurDealSort("deal_size")).toBe("deal_size")
  })

  it("orders the remaining deal flow by relevance by default", () => {
    const sorted = sortRepreneurDealFlow(
      [
        opportunity({ opportunity_id: "possible", relevance_score: 67 }),
        opportunity({ opportunity_id: "strong", relevance_score: 85 }),
        opportunity({ opportunity_id: "weak", relevance_score: 48 }),
      ],
      "relevance",
    )

    expect(sorted.map((item) => item.opportunity_id)).toEqual(["strong", "possible", "weak"])
  })

  it("supports deal size and date-added sorts without dropping relevance as a tie-breaker", () => {
    const opportunities = [
      opportunity({ opportunity_id: "small", revenue_meur: 2, relevance_score: 80, date_added: "2026-05-01" }),
      opportunity({ opportunity_id: "large-low", revenue_meur: 8, relevance_score: 50, date_added: "2026-06-01" }),
      opportunity({ opportunity_id: "large-high", revenue_meur: 8, relevance_score: 90, date_added: "2026-07-01" }),
    ]

    expect(sortRepreneurDealFlow(opportunities, "deal_size").map((item) => item.opportunity_id)).toEqual([
      "large-high",
      "large-low",
      "small",
    ])
    expect(sortRepreneurDealFlow(opportunities, "date_added").map((item) => item.opportunity_id)).toEqual([
      "large-high",
      "large-low",
      "small",
    ])
  })
})
