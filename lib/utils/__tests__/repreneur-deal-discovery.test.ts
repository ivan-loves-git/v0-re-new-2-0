import { describe, expect, it } from "vitest";
import {
  EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
  filterRepreneurDeals,
  getEbitdaMarginPercentage,
  partitionRepreneurDeals,
} from "../repreneur-deal-discovery";
import type { RepreneurDealFlowSortCandidate } from "../repreneur-deal-flow";

function opportunity(
  overrides: Partial<RepreneurDealFlowSortCandidate> = {},
): RepreneurDealFlowSortCandidate {
  return {
    match_id: "match-1",
    match_status: "proposed",
    visible_documents: [],
    opportunity_id: "opportunity-1",
    reference: "RN-1001",
    public_title: "Precision engineering business",
    teaser_summary: "A specialist operator serving industrial customers.",
    geography_node_id: "geo-lyon",
    canonical_sector: "Industrie manufacturière",
    sector: "Industry",
    activity: "Engineering",
    location: "Lyon",
    revenue_meur: 3,
    ebitda_keur: 450,
    headcount: 30,
    headcount_range: null,
    updated_at: "2026-07-15T09:00:00.000Z",
    is_staff_recommended: false,
    is_outside_current_criteria: false,
    relevance_grade: "possible_fit",
    relevance_score: 60,
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
        "specialist operator",
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

  it("calculates EBITDA margin and applies canonical AND-combined filters", () => {
    const deal = opportunity();

    expect(getEbitdaMarginPercentage(deal)).toBe(15);
    expect(
      filterRepreneurDeals([deal], "", {
        geography: "geo-lyon",
        sector: "Industrie manufacturière",
        revenueMin: "3",
        revenueMax: "3",
        ebitdaMarginMin: "15",
        employeesMin: "30",
        employeesMax: "30",
      }),
    ).toEqual([deal]);
  });

  it("uses inclusive bounds and excludes missing metrics when a numeric filter is active", () => {
    const deal = opportunity();
    const missingMetrics = opportunity({
      opportunity_id: "missing",
      revenue_meur: null,
      ebitda_keur: null,
      headcount: null,
      headcount_range: null,
    });

    expect(filterRepreneurDeals([deal], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      revenueMin: "3",
      revenueMax: "3",
      ebitdaMarginMin: "15",
      employeesMin: "30",
      employeesMax: "30",
    })).toEqual([deal]);
    expect(filterRepreneurDeals([missingMetrics], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      revenueMin: "1",
    })).toEqual([]);
    expect(filterRepreneurDeals([missingMetrics], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      ebitdaMarginMin: "1",
    })).toEqual([]);
    expect(filterRepreneurDeals([missingMetrics], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      employeesMin: "1",
    })).toEqual([]);
  });

  it("keeps input order inside the decided presentation sections", () => {
    const recommended = opportunity({
      match_id: "recommended",
      is_staff_recommended: true,
    });
    const remaining = opportunity({ match_id: "remaining" });
    const outside = opportunity({
      match_id: "outside",
      is_outside_current_criteria: true,
    });
    const declined = opportunity({
      match_id: "declined",
      match_status: "declined",
      is_staff_recommended: true,
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
