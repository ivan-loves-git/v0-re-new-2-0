import { describe, expect, it } from "vitest"
import {
  calculateOpportunityMatchScore,
  MATCHING_V2_CONFIG,
} from "../opportunity-match-scoring"

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
const score = (
  changes: Record<string, unknown> = {},
  profile: Record<string, unknown> = {},
) =>
  calculateOpportunityMatchScore(
    { ...repreneur, ...profile },
    { ...opportunity, ...changes },
  )
const revenueOnly = (value: number) =>
  score(
    { revenue_meur: value },
    {
      target_ebitda_min_keur: null,
      target_ebitda_max_keur: null,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    },
  )
const absoluteEbitdaOnly = (value: number) =>
  score(
    { ebitda_keur: value },
    {
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    },
  )
const marginOnly = (
  marginPercent: number,
  targets: Record<string, unknown> = {},
) =>
  score(
    { revenue_meur: 100, ebitda_keur: marginPercent * 1_000 },
    {
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_min_keur: null,
      target_ebitda_max_keur: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
      ...targets,
    },
  )
const headcountOnly = (value: number, targets: Record<string, unknown> = {}) =>
  score(
    { headcount: value },
    {
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_min_keur: null,
      target_ebitda_max_keur: null,
      target_ebitda_margin_min_pct: null,
      ...targets,
    },
  )

describe("calculateOpportunityMatchScore — flexible numeric Matching 2.2", () => {
  it("keeps blank targeted values as review rather than converting them to zero", () => {
    expect(score({ revenue_meur: "   " }).recommendation).toBe("not_evaluated")
  })

  it("lets known sector exclusion dominate incomplete financial evidence", () => {
    const result = score({ sector: "unrelated sector", revenue_meur: null })
    expect(result.recommendation).toBe("not_fit")
    expect(result.score).toBe(0)
    expect(result.reasons.some((reason) => reason.includes("needs review"))).toBe(true)
  })

  it("accepts observed EBITDA losses but requires positive revenue to assess margin", () => {
    expect(score({ ebitda_keur: -1, revenue_meur: 100 }).recommendation).not.toBe("not_evaluated")
    expect(score({ ebitda_keur: -1, revenue_meur: null }).recommendation).toBe("not_evaluated")
  })
  it("uses the explicit four-criterion Gaussian calibration", () => {
    expect(MATCHING_V2_CONFIG).toEqual({
      version: "2.2-gaussian-2026-09-11",
      weights: {
        revenue: 36,
        absoluteEbitda: 29,
        ebitdaMargin: 21,
        headcount: 14,
      },
      numericFalloff: {
        sigma: 0.3,
        minimumRoundedScore: 1,
        zeroScaleFloors: {
          revenueMeur: 1,
          absoluteEbitdaKeur: 100,
          ebitdaMarginPercentagePoints: 1,
          headcount: 1,
        },
      },
      evidence: { reviewMaximumScore: 70, noUsableEvidenceRecommendation: "not_evaluated" },
    })
    expect(score()).toMatchObject({ score: 100, recommendation: "strong_fit" })
  })

  it("gives full credit inside revenue and absolute EBITDA ranges and tapers continuously outside", () => {
    expect(revenueOnly(100).score).toBe(100)
    expect(revenueOnly(200).score).toBe(100)
    expect(revenueOnly(95).score).toBe(99)
    expect(revenueOnly(90).score).toBe(95)
    expect(revenueOnly(60).score).toBe(41)
    expect(revenueOnly(20)).toMatchObject({ score: 3, recommendation: "not_fit" })
    expect(revenueOnly(-100)).toMatchObject({ score: 0, recommendation: "not_evaluated" })
    expect(absoluteEbitdaOnly(10_000).score).toBe(100)
    expect(absoluteEbitdaOnly(20_000).score).toBe(100)
    expect(absoluteEbitdaOnly(9_000).score).toBe(95)
    expect(absoluteEbitdaOnly(6_000).score).toBe(41)
    expect(absoluteEbitdaOnly(-1).score).toBe(1)
  })

  it("uses the nearest bound for one-sided ranges", () => {
    expect(
      score(
        { revenue_meur: 100 },
        {
          target_revenue_min_meur: 100,
          target_revenue_max_meur: null,
          target_ebitda_min_keur: null,
          target_ebitda_max_keur: null,
          target_ebitda_margin_min_pct: null,
          target_staff_size_min: null,
          target_staff_size_max: null,
        },
      ).score,
    ).toBe(100)
    expect(
      score(
        { revenue_meur: 95 },
        {
          target_revenue_min_meur: 100,
          target_revenue_max_meur: null,
          target_ebitda_min_keur: null,
          target_ebitda_max_keur: null,
          target_ebitda_margin_min_pct: null,
          target_staff_size_min: null,
          target_staff_size_max: null,
        },
      ).score,
    ).toBe(99)
    expect(
      score(
        { ebitda_keur: 23_000 },
        {
          target_revenue_min_meur: null,
          target_revenue_max_meur: null,
          target_ebitda_min_keur: null,
          target_ebitda_max_keur: 20_000,
          target_ebitda_margin_min_pct: null,
          target_staff_size_min: null,
          target_staff_size_max: null,
        },
      ).score,
    ).toBe(88)
  })

  it("uses a Gaussian minimum-margin taper and a documented zero-bound scale", () => {
    expect(marginOnly(9).score).toBe(95)
    expect(marginOnly(9.5).score).toBe(99)
    expect(marginOnly(10).score).toBe(100)
    expect(marginOnly(15).score).toBe(100)
    expect(marginOnly(20).score).toBe(100)
    expect(marginOnly(0, { target_ebitda_margin_min_pct: 0 }).score).toBe(100)
    expect(marginOnly(-0.4, { target_ebitda_margin_min_pct: 0 }).score).toBe(41)
  })

  it("uses the same non-excluding Gaussian taper for headcount", () => {
    expect(headcountOnly(0).score).toBe(1)
    expect(headcountOnly(40).score).toBe(54)
    expect(headcountOnly(50).score).toBe(8)
    expect(
      headcountOnly(5, {
        target_staff_size_min: 10,
        target_staff_size_max: null,
      }).score,
    ).toBe(25)
    expect(
      headcountOnly(0, {
        target_staff_size_min: 10,
        target_staff_size_max: null,
      }).score,
    ).toBe(1)
    expect(
      headcountOnly(10, {
        target_staff_size_min: 10,
        target_staff_size_max: 10,
      }).score,
    ).toBe(100)
    expect(
      headcountOnly(11, {
        target_staff_size_min: 10,
        target_staff_size_max: 10,
      }).score,
    ).toBe(95)
    expect(
      headcountOnly(30, {
        target_staff_size_min: null,
        target_staff_size_max: 30,
      }).score,
    ).toBe(100)
    expect(
      headcountOnly(45, {
        target_staff_size_min: null,
        target_staff_size_max: 30,
      }).score,
    ).toBe(25)
  })

  it("omits buyer-undefined criteria, caps targeted missing evidence, and never invents a fit", () => {
    expect(
      score(
        {},
        {
          target_revenue_min_meur: null,
          target_revenue_max_meur: null,
          target_ebitda_min_keur: null,
          target_ebitda_max_keur: null,
          target_ebitda_margin_min_pct: null,
          target_staff_size_min: null,
          target_staff_size_max: null,
        },
      ),
    ).toMatchObject({ score: 0, recommendation: "not_evaluated" })
    expect(score({ revenue_meur: null })).toMatchObject({
      score: 70,
      recommendation: "not_evaluated",
    })
    expect(
      score({}, { target_revenue_min_meur: 200, target_revenue_max_meur: 100 }),
    ).toMatchObject({ score: 70, recommendation: "not_evaluated" })
  })

  it("labels a sole targeted missing metric as not evaluated rather than not fit", () => {
    expect(
      score(
        { revenue_meur: null },
        {
          target_ebitda_min_keur: null,
          target_ebitda_max_keur: null,
          target_ebitda_margin_min_pct: null,
          target_staff_size_min: null,
          target_staff_size_max: null,
        },
      ),
    ).toMatchObject({ score: 0, recommendation: "not_evaluated" })
  })

  it("does not turn partial low evidence into a fit while another targeted field needs review", () => {
    expect(score(
      { revenue_meur: 20, headcount: null },
      {
        target_ebitda_min_keur: null,
        target_ebitda_max_keur: null,
        target_ebitda_margin_min_pct: null,
      },
    )).toMatchObject({ score: 3, recommendation: "not_evaluated" })
    expect(score(
      { revenue_meur: 20 },
      {
        target_ebitda_min_keur: null,
        target_ebitda_max_keur: null,
        target_ebitda_margin_min_pct: null,
        target_staff_size_min: null,
        target_staff_size_max: null,
      },
    )).toMatchObject({ score: 3, recommendation: "not_fit" })
  })

  it("makes known sector, geography, financial and namespace exclusions unambiguous not_fit", () => {
    expect(score({}, { q13_target_sectors_v2: ["healthcare"] })).toMatchObject({
      score: 0,
      recommendation: "not_fit",
    })
    expect(
      score(
        {
          geography_node_id: "idf",
          geography_path_stable_keys: ["fr-idf", "france"],
        },
        {
          target_geography_paths_stable_keys: [["fr-bretagne", "france"]],
        },
      ),
    ).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(score({ is_demo: true })).toMatchObject({
      score: 0,
      recommendation: "not_fit",
    })
  })

  it("keeps unknown sector and geography as review, and ignores WHO/WHEN/tags/freshness", () => {
    const baseline = score()
    expect(
      score({}, { q13_target_sectors_v2: null, q12_geo_zones: null }),
    ).toMatchObject({ score: 70, recommendation: "not_evaluated" })
    expect(
      score(
        {},
        {
          who_score: 0,
          when_score: 0,
          scoring_flags: ["review"],
          thesis_tags: ["ignored"],
          skills: ["ignored"],
          profile_freshness: "stale",
        },
      ),
    ).toEqual(baseline)
  })

  it("keeps hard categorical and namespace mismatches at zero", () => {
    expect(score({}, { q13_target_sectors_v2: ["healthcare"] })).toMatchObject({
      score: 0,
      recommendation: "not_fit",
    })
  })

  it("keeps canonical geography compatibility and legacy sector aliases", () => {
    expect(
      score(
        {
          geography_node_id: "idf",
          geography_path_stable_keys: ["fr-region-ile-de-france", "france"],
        },
        {
          target_geography_paths_stable_keys: [["france"]],
        },
      ).score,
    ).toBe(100)
    expect(
      score(
        {
          geography_node_id: "idf",
          geography_path_stable_keys: [
            "fr-region-ile-de-france",
            "fr-macro-ile-de-france",
            "france",
          ],
        },
        {
          target_geography_paths_stable_keys: [
            ["fr-macro-ile-de-france", "france"],
          ],
        },
      ).score,
    ).toBe(100)
    expect(
      score(
        {
          geography_node_id: "france",
          geography_path_stable_keys: ["france"],
        },
        {
          target_geography_paths_stable_keys: [
            ["fr-region-ile-de-france", "france"],
          ],
        },
      ),
    ).toMatchObject({ score: 70, recommendation: "not_evaluated" })
    expect(
      score(
        {
          geography_node_id: "idf",
          geography_path_stable_keys: ["fr-idf", "france"],
        },
        {
          target_geography_paths_stable_keys: null,
        },
      ),
    ).toMatchObject({ score: 70, recommendation: "not_evaluated" })
    expect(
      score(
        { sector: "Digital/IT services" },
        {
          q13_target_sectors_v2: ["Tech & Digital"],
        },
      ).score,
    ).toBe(100)
    expect(
      score(
        { sector: null, activity: "BTP / Construction" },
        { q13_target_sectors_v2: ["BTP & Construction"] },
      ).score,
    ).toBe(100)
    expect(
      score(
        { sector: null, activity: "BTP / Construction" },
        { q13_target_sectors_v2: ["healthcare"] },
      ),
    ).toMatchObject({ score: 0, recommendation: "not_fit" })
    expect(
      score(
        { sector: null, activity: "Unclassified family business" },
        { q13_target_sectors_v2: ["other"] },
      ),
    ).toMatchObject({ score: 0, recommendation: "not_fit" })
  })
})
