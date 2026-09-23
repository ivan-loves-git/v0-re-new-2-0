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
        geography: ["geo-lyon"],
        sector: ["Industrie manufacturière"],
        revenueMin: "3",
        revenueMax: "3",
        ebitdaMarginMin: "15",
        employeesMin: "30",
        employeesMax: "30",
      }),
    ).toEqual([deal]);
  });

  it("uses OR within each taxonomy dimension and AND across dimensions", () => {
    const lyonManufacturing = opportunity({ match_id: "lyon-manufacturing" })
    const lilleServices = opportunity({ match_id: "lille-services", geography_node_id: "geo-lille", canonical_sector: "Services" })
    const lyonOther = opportunity({ match_id: "lyon-other", canonical_sector: "Other" })
    const parisServices = opportunity({ match_id: "paris-services", geography_node_id: "geo-paris", canonical_sector: "Services" })

    expect(filterRepreneurDeals([lyonManufacturing, lilleServices, lyonOther, parisServices], "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      geography: ["geo-lyon", "geo-lille"],
      sector: ["Industrie manufacturière", "Services"],
    }).map((deal) => deal.match_id)).toEqual(["lyon-manufacturing", "lille-services"])
  })

  it("selects descendant IDs once while a narrow region excludes broader unknown precision", () => {
    const fr = { id: "fr", label: "France", nodeLevel: "country" as const, parentLabel: null }
    const idf = { id: "idf-macro", label: "Île-de-France", nodeLevel: "macro_zone" as const, parentLabel: "France", equivalentNodeIds: ["idf-region"] }
    const west = { id: "west", label: "Grand Ouest", nodeLevel: "macro_zone" as const, parentLabel: "France" }
    const bretagne = { id: "bretagne", label: "Bretagne", nodeLevel: "region" as const, parentLabel: "Grand Ouest" }
    const deals = [
      opportunity({ opportunity_id: "france-only", geography_node_id: "fr", geography_filter_nodes: [fr] }),
      opportunity({ opportunity_id: "idf-macro", geography_node_id: "idf-macro", geography_filter_nodes: [idf, fr] }),
      opportunity({ opportunity_id: "idf-region", geography_node_id: "idf-region", geography_filter_nodes: [idf, fr], canonical_sector: "Services" }),
      opportunity({ opportunity_id: "west-macro", geography_node_id: "west", geography_filter_nodes: [west, fr] }),
      opportunity({ opportunity_id: "bretagne", geography_node_id: "bretagne", geography_filter_nodes: [bretagne, west, fr] }),
      opportunity({ opportunity_id: "unmapped", geography_node_id: null, geography_filter_nodes: [] }),
    ]
    const ids = (geography: string[], sector: string[] = []) => filterRepreneurDeals(deals, "", {
      ...EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS,
      geography,
      sector,
    }).map((deal) => deal.opportunity_id)

    expect(ids(["fr"])).toEqual(["france-only", "idf-macro", "idf-region", "west-macro", "bretagne"])
    expect(ids(["idf-macro"])).toEqual(["idf-macro", "idf-region"])
    expect(ids(["idf-region"])).toEqual(["idf-macro", "idf-region"])
    expect(ids(["west"])).toEqual(["west-macro", "bretagne"])
    expect(ids(["bretagne"])).toEqual(["bretagne"])
    expect(ids(["idf-macro", "west"])).toEqual(["idf-macro", "idf-region", "west-macro", "bretagne"])
    expect(ids(["idf-macro", "west"], ["Services"])).toEqual(["idf-region"])
  })

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
