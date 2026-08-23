import { describe, expect, it } from "vitest"
import {
  calculateOpportunityMatchScore,
  MATCHING_V2_CONFIG,
} from "../opportunity-match-scoring"

const completeRepreneur = {
  q13_target_sectors_v2: ["industry"],
  q12_geo_zones: ["ile-de-france"],
  target_revenue_min_meur: 1.5,
  target_revenue_max_meur: 3,
  target_ebitda_margin_min_pct: 12,
  target_staff_size_min: 10,
  target_staff_size_max: 40,
}

const completeOpportunity = {
  sector: "industry",
  activity: "precision workshop",
  location: "Île-de-France",
  revenue_meur: 2,
  ebitda_keur: 300,
  headcount: 24,
}

describe("calculateOpportunityMatchScore", () => {
  it("publishes one named provisional calibration", () => {
    expect(MATCHING_V2_CONFIG).toMatchObject({
      version: "provisional-2026-08-23",
      weights: {
        sector: 30,
        geography: 25,
        revenue: 25,
        ebitdaMargin: 12,
        headcount: 8,
      },
      tolerances: {
        rangeRelativeOutside: 0.2,
        ebitdaMarginPercentagePointsBelow: 2,
      },
    })
  })

  it("returns a strong fit when all five Matching v2 inputs align", () => {
    const result = calculateOpportunityMatchScore(
      completeRepreneur,
      completeOpportunity,
    )

    expect(result.score).toBe(100)
    expect(result.recommendation).toBe("strong_fit")
    expect(result.reasons).toEqual([
      "Sector or activity matches the repreneur target preference.",
      "Location matches the repreneur geographic preference.",
      "Revenue is within the target range.",
      "EBITDA margin meets the minimum target.",
      "Headcount is within the target range.",
    ])
  })

  it("does not use WHO, WHEN, or scoring flags for signed-client matching", () => {
    const lowQualification = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        who_score: 0,
        when_score: 0,
        scoring_flags: ["review"],
      },
      completeOpportunity,
    )
    const highQualification = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        who_score: 100,
        when_score: 100,
        scoring_flags: [],
      },
      completeOpportunity,
    )

    expect(lowQualification).toEqual(highQualification)
  })

  it("treats revenue and headcount bounds as inclusive", () => {
    for (const [revenue, headcount] of [[1.5, 10], [3, 40]]) {
      const result = calculateOpportunityMatchScore(
        completeRepreneur,
        { ...completeOpportunity, revenue_meur: revenue, headcount },
      )

      expect(result.reasons).toContain("Revenue is within the target range.")
      expect(result.reasons).toContain("Headcount is within the target range.")
    }
  })

  it("gives half credit inside the provisional 20 percent range tolerance", () => {
    const result = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 3.5, headcount: 45 },
    )

    expect(result.reasons).toContain(
      "Revenue is close to the target range and needs staff judgement.",
    )
    expect(result.reasons).toContain(
      "Headcount is close to the target range and needs staff judgement.",
    )
  })

  it("marks values beyond the provisional range tolerance as mismatches", () => {
    const result = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 4, headcount: 50 },
    )

    expect(result.reasons).toContain("Revenue is outside the target range.")
    expect(result.reasons).toContain("Headcount is outside the target range.")
  })

  it("calculates EBITDA margin from kEUR EBITDA and mEUR revenue", () => {
    const atThreshold = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 2, ebitda_keur: 240 },
    )
    const borderline = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 2, ebitda_keur: 220 },
    )
    const mismatch = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 2, ebitda_keur: 180 },
    )

    expect(atThreshold.reasons).toContain("EBITDA margin meets the minimum target.")
    expect(borderline.reasons).toContain(
      "EBITDA margin is close to the minimum target and needs staff judgement.",
    )
    expect(mismatch.reasons).toContain("EBITDA margin is below the minimum target.")
  })

  it("uses the provisional 0 percent margin fallback without changing buyer data", () => {
    const result = calculateOpportunityMatchScore(
      { ...completeRepreneur, target_ebitda_margin_min_pct: null },
      completeOpportunity,
    )

    expect(result.reasons).toContain(
      "EBITDA margin meets the provisional 0% fallback because no buyer minimum is recorded.",
    )
  })

  it("does not turn missing financial data into a fake strong fit", () => {
    const result = calculateOpportunityMatchScore(
      {
        q13_target_sectors_v2: ["industry"],
        q12_geo_zones: ["ile-de-france"],
      },
      {
        sector: "industry",
        location: "Île-de-France",
        revenue_meur: null,
        ebitda_keur: null,
        headcount: null,
      },
    )

    expect(result.score).toBe(70)
    expect(result.recommendation).toBe("possible_fit")
    expect(result.reasons).toContain(
      "Revenue needs review because the target or opportunity value is missing.",
    )
    expect(result.reasons).toContain(
      "EBITDA margin needs review because opportunity revenue or EBITDA is missing.",
    )
  })

  it("keeps any incomplete criterion in staff review even with strong known evidence", () => {
    const result = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        target_staff_size_min: null,
        target_staff_size_max: null,
      },
      completeOpportunity,
    )

    expect(result.score).toBe(70)
    expect(result.recommendation).toBe("possible_fit")
    expect(result.reasons).toContain(
      "Headcount needs review because the target or opportunity value is missing.",
    )
  })

  it("keeps clear revenue and margin misses outside normal recommendations", () => {
    const revenueMiss = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, revenue_meur: 4 },
    )
    const marginMiss = calculateOpportunityMatchScore(
      completeRepreneur,
      { ...completeOpportunity, ebitda_keur: 180 },
    )

    expect(revenueMiss.score).toBe(44)
    expect(revenueMiss.recommendation).toBe("not_fit")
    expect(marginMiss.score).toBe(44)
    expect(marginMiss.recommendation).toBe("not_fit")
  })

  it("keeps a known sector mismatch outside normal recommendations", () => {
    const result = calculateOpportunityMatchScore(
      { ...completeRepreneur, q13_target_sectors_v2: ["healthcare"] },
      completeOpportunity,
    )

    expect(result.score).toBe(44)
    expect(result.recommendation).toBe("not_fit")
    expect(result.reasons).toContain(
      "Sector or activity does not match the repreneur target preferences.",
    )
  })

  it("matches an all-France target to a canonical region", () => {
    const result = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        target_geography_paths_stable_keys: [["france"]],
      },
      {
        ...completeOpportunity,
        geography_node_id: "region-idf",
        geography_path_stable_keys: [
          "fr-region-ile-de-france",
          "fr-macro-ile-de-france",
          "france",
        ],
      },
    )

    expect(result.reasons).toContain(
      "Geography matches the canonical France hierarchy.",
    )
  })

  it("matches an ancestor target to a narrower canonical opportunity", () => {
    const result = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        target_geography_paths_stable_keys: [
          ["fr-macro-south-east", "france"],
        ],
      },
      {
        ...completeOpportunity,
        geography_node_id: "region-aura",
        geography_path_stable_keys: [
          "fr-region-auvergne-rhone-alpes",
          "fr-macro-south-east",
          "france",
        ],
      },
    )

    expect(result.score).toBe(100)
    expect(result.reasons).toContain(
      "Geography matches the canonical France hierarchy.",
    )
  })

  it("marks a broader opportunity than the target area for review", () => {
    const result = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        target_geography_paths_stable_keys: [
          ["fr-region-ile-de-france", "fr-macro-ile-de-france", "france"],
        ],
      },
      {
        ...completeOpportunity,
        geography_node_id: "france-node",
        geography_path_stable_keys: ["france"],
      },
    )

    expect(result.score).toBe(70)
    expect(result.reasons).toContain(
      "Geography needs review because the opportunity is broader than the target area.",
    )
  })

  it("demotes a disjoint canonical geography but keeps it visible", () => {
    const result = calculateOpportunityMatchScore(
      {
        ...completeRepreneur,
        target_geography_paths_stable_keys: [
          ["fr-region-bretagne", "fr-macro-west", "france"],
        ],
      },
      {
        ...completeOpportunity,
        geography_node_id: "region-idf",
        geography_path_stable_keys: [
          "fr-region-ile-de-france",
          "fr-macro-ile-de-france",
          "france",
        ],
      },
    )

    expect(result.score).toBe(60)
    expect(result.recommendation).toBe("weak_fit")
    expect(result.reasons).toContain(
      "Geography does not match the canonical France hierarchy.",
    )
  })

  it("does not infer an unmapped special geography label", () => {
    const result = calculateOpportunityMatchScore(
      { ...completeRepreneur, q12_geo_zones: ["Grand Ouest"] },
      { ...completeOpportunity, location: "Bretagne" },
    )

    expect(result.score).toBe(70)
    expect(result.reasons).toContain(
      "Geography needs review because the current data is incomplete or not mapped.",
    )
  })

  it("requires review when a canonical opportunity has no mapped target bridge", () => {
    const result = calculateOpportunityMatchScore(
      completeRepreneur,
      {
        ...completeOpportunity,
        geography_node_id: "region-idf",
        geography_path_stable_keys: [
          "fr-region-ile-de-france",
          "fr-macro-ile-de-france",
          "france",
        ],
      },
    )

    expect(result.score).toBe(70)
    expect(result.reasons).toContain(
      "Geography needs review because one side has not been mapped to the France hierarchy.",
    )
  })

  it("keeps canonical Tech and Digital selections compatible with legacy labels", () => {
    const result = calculateOpportunityMatchScore(
      { ...completeRepreneur, q13_target_sectors_v2: ["Tech & Digital"] },
      { ...completeOpportunity, sector: "Digital/IT services" },
    )

    expect(result.reasons).toContain(
      "Sector or activity matches the repreneur target preference.",
    )
  })

  it("matches both successors of a broad legacy Services opportunity", () => {
    for (const target of [
      "Services aux entreprises (B2B)",
      "Services aux particuliers (B2C)",
    ]) {
      const result = calculateOpportunityMatchScore(
        { ...completeRepreneur, q13_target_sectors_v2: [target] },
        { ...completeOpportunity, sector: "Services" },
      )

      expect(result.reasons).toContain(
        "Sector or activity matches the repreneur target preference.",
      )
    }
  })

  it("matches both successors of a broad legacy Sante target", () => {
    for (const sector of [
      "Industrie pharmaceutique & Dispositifs médicaux",
      "Services de santé",
    ]) {
      const result = calculateOpportunityMatchScore(
        { ...completeRepreneur, q13_target_sectors_v2: ["healthcare"] },
        { ...completeOpportunity, sector },
      )

      expect(result.reasons).toContain(
        "Sector or activity matches the repreneur target preference.",
      )
    }
  })
})
