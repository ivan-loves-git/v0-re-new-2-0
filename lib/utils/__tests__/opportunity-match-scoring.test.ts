import { describe, expect, it } from "vitest"
import { calculateOpportunityMatchScore, MATCHING_V2_CONFIG } from "../opportunity-match-scoring"

const repreneur = {
  is_demo: false,
  q13_target_sectors_v2: ["industry"],
  q12_geo_zones: ["ile-de-france"],
  target_revenue_min_meur: 100,
  target_revenue_max_meur: 200,
  target_ebitda_min_keur: 10_000,
  target_ebitda_max_keur: 20_000,
  target_ebitda_margin_min_pct: 10,
  target_staff_size_min: 10,
  target_staff_size_max: 30,
}
const opportunity = {
  is_demo: false,
  sector: "industry",
  location: "Île-de-France",
  revenue_meur: 150,
  ebitda_keur: 15_000,
  headcount: 20,
}
const score = (changes: Record<string, unknown> = {}, profile: Record<string, unknown> = {}) =>
  calculateOpportunityMatchScore({ ...repreneur, ...profile }, { ...opportunity, ...changes })
const revenueOnly = (value: number) => score({ revenue_meur: value }, {
  target_ebitda_min_keur: null, target_ebitda_max_keur: null,
  target_ebitda_margin_min_pct: null, target_staff_size_min: null, target_staff_size_max: null,
})
const absoluteEbitdaOnly = (value: number) => score({ ebitda_keur: value }, {
  target_revenue_min_meur: null, target_revenue_max_meur: null,
  target_ebitda_margin_min_pct: null, target_staff_size_min: null, target_staff_size_max: null,
})
const marginOnly = (marginPercent: number, targets: Record<string, unknown> = {}) => score({ revenue_meur: 100, ebitda_keur: marginPercent * 1_000 }, {
  target_revenue_min_meur: null, target_revenue_max_meur: null,
  target_ebitda_min_keur: null, target_ebitda_max_keur: null,
  target_staff_size_min: null, target_staff_size_max: null, ...targets,
})
const headcountOnly = (value: number, targets: Record<string, unknown> = {}) => score({ headcount: value }, {
  target_revenue_min_meur: null, target_revenue_max_meur: null,
  target_ebitda_min_keur: null, target_ebitda_max_keur: null,
  target_ebitda_margin_min_pct: null,
  ...targets,
})

describe("calculateOpportunityMatchScore — Matching 2.1", () => {
  it("uses the explicit four-criterion 2.1 calibration", () => {
    expect(MATCHING_V2_CONFIG).toEqual({
      version: "2.1-candidate-2026-08-29",
      weights: { revenue: 36, absoluteEbitda: 29, ebitdaMargin: 21, headcount: 14 },
      rangeBuffers: { lower: 0.9, upper: 1.3 },
      evidence: { reviewMaximumScore: 70 },
    })
    expect(score()).toMatchObject({ score: 92, recommendation: "strong_fit" })
  })

  it("pins revenue and absolute EBITDA inclusive boundaries, buffer midpoints and hard limits", () => {
    expect(revenueOnly(100).score).toBe(100)
    expect(revenueOnly(200).score).toBe(100)
    expect(revenueOnly(95).score).toBe(50)
    expect(revenueOnly(90).score).toBe(0)
    expect(revenueOnly(89.99)).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(revenueOnly(230).score).toBe(50)
    expect(revenueOnly(260).score).toBe(0)
    expect(revenueOnly(260.01)).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(absoluteEbitdaOnly(10_000).score).toBe(100)
    expect(absoluteEbitdaOnly(9_500).score).toBe(50)
    expect(absoluteEbitdaOnly(9_000).score).toBe(0)
    expect(absoluteEbitdaOnly(8_999.99)).toMatchObject({ score: 0, recommendation: "not_fit" })
  })

  it("uses the exact continuous EBITDA margin curve and deterministic zero threshold", () => {
    // revenue 100 mEUR: 9%, 9.5%, 10%, 15%, 20% and >20% respectively.
    expect(marginOnly(9).score).toBe(0)
    expect(marginOnly(9.5).score).toBe(30)
    expect(marginOnly(10).score).toBe(60)
    expect(marginOnly(15).score).toBe(80)
    expect(marginOnly(20).score).toBe(100)
    expect(marginOnly(8.99999)).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(marginOnly(0, { target_ebitda_margin_min_pct: 0 }).score).toBe(100)
    expect(marginOnly(-0.00001, { target_ebitda_margin_min_pct: 0 })).toMatchObject({ score: 0, recommendation: "not_fit" })
  })

  it("keeps headcount non-excluding with range, one-sided and zero-width decay", () => {
    expect(headcountOnly(0).score).toBe(50)
    expect(headcountOnly(40).score).toBe(50)
    expect(headcountOnly(50).score).toBe(0)
    expect(headcountOnly(5, { target_staff_size_min: 10, target_staff_size_max: null }).score).toBe(50)
    expect(headcountOnly(0, { target_staff_size_min: 10, target_staff_size_max: null }).score).toBe(0)
    expect(headcountOnly(10, { target_staff_size_min: 10, target_staff_size_max: 10 }).score).toBe(100)
    expect(headcountOnly(11, { target_staff_size_min: 10, target_staff_size_max: 10 }).score).toBe(0)
  })

  it("omits buyer-undefined criteria, caps targeted missing evidence, and never invents a fit", () => {
    expect(score({}, {
      target_revenue_min_meur: null, target_revenue_max_meur: null,
      target_ebitda_min_keur: null, target_ebitda_max_keur: null,
      target_ebitda_margin_min_pct: null, target_staff_size_min: null, target_staff_size_max: null,
    })).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(score({ revenue_meur: null })).toMatchObject({ score: 70, recommendation: "possible_fit" })
    expect(score({}, { target_revenue_min_meur: 200, target_revenue_max_meur: 100 })).toMatchObject({ score: 70, recommendation: "possible_fit" })
  })

  it("makes known sector, geography, financial and namespace exclusions unambiguous not_fit", () => {
    expect(score({}, { q13_target_sectors_v2: ["healthcare"] })).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(score({ geography_node_id: "idf", geography_path_stable_keys: ["fr-idf", "france"] }, {
      target_geography_paths_stable_keys: [["fr-bretagne", "france"]],
    })).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(score({ is_demo: true })).toMatchObject({ score: 0, recommendation: "not_fit" })
  })

  it("keeps unknown sector and geography as review, and ignores WHO/WHEN/tags/freshness", () => {
    const baseline = score()
    expect(score({}, { q13_target_sectors_v2: null, q12_geo_zones: null })).toMatchObject({ score: 70, recommendation: "possible_fit" })
    expect(score({}, {
      who_score: 0, when_score: 0, scoring_flags: ["review"],
      thesis_tags: ["ignored"], skills: ["ignored"], profile_freshness: "stale",
    })).toEqual(baseline)
  })
})
