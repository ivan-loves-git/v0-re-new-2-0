import { describe, expect, it } from "vitest";
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
  getEbitdaMarginPercentage,
  partitionRepreneurDeals,
} from "../repreneur-deal-discovery";
import type { RepreneurOpportunityExposure } from "@/lib/types/opportunity";

function opportunity(
  overrides: Partial<RepreneurOpportunityExposure> = {},
): RepreneurOpportunityExposure {
  return {
    match_id: "match-1",
    match_status: "proposed",
    visible_documents: [],
    opportunity_id: "opportunity-1",
    reference: "RN-1001",
    public_title: "Precision engineering business",
    sector: "Industry",
    activity: "Engineering",
    location: "Lyon",
    revenue_meur: 3,
    ebitda_keur: 450,
    headcount: 30,
    headcount_range: null,
    platform_recommendation: "possible_fit",
    platform_reasons: [],
    human_recommendation: "not_evaluated",
    updated_at: "2026-07-15T09:00:00.000Z",
    ...overrides,
  };
}

describe("repreneur deal discovery", () => {
  it("finds deals through each requested searchable field", () => {
    const deal = opportunity();

    expect(
      filterRepreneurDeals(
        [deal],
        "Precision",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals(
        [deal],
        "RN-1001",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals(
        [deal],
        "Lyon",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals(
        [deal],
        "Industry",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals([deal], "3", EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals(
        [deal],
        "15",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
    expect(
      filterRepreneurDeals(
        [deal],
        "30",
        EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ),
    ).toEqual([deal]);
  });

  it("calculates EBITDA margin and applies the deal filters", () => {
    const deal = opportunity();

    expect(getEbitdaMarginPercentage(deal)).toBe(15);
    expect(
      filterRepreneurDeals([deal], "", {
        geography: "lyon",
        sector: "industry",
        revenue: "first-to-second",
        ebitdaMargin: "first-to-second",
        employees: "first-to-second",
      }),
    ).toEqual([deal]);
  });

  it("keeps input order inside the decided presentation sections", () => {
    const recommended = opportunity({
      match_id: "recommended",
      human_recommendation: "strong_fit",
    });
    const remaining = opportunity({ match_id: "remaining" });
    const outside = opportunity({
      match_id: "outside",
      platform_recommendation: "not_fit",
    });
    const declined = opportunity({
      match_id: "declined",
      match_status: "declined",
      human_recommendation: "strong_fit",
    });

    expect(
      partitionRepreneurDeals([remaining, recommended, outside, declined]),
    ).toEqual({
      staffRecommended: [recommended],
      remaining: [remaining],
      outsideCurrentCriteria: [outside],
      declined: [declined],
    });
  });
});
