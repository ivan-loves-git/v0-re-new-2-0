import { describe, expect, it } from "vitest"
import { calculateOpportunityMatchScore } from "../opportunity-match-scoring"

describe("calculateOpportunityMatchScore", () => {
  it("returns a strong fit when readiness, sector, geography, and deal size align", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 90,
        when_score: 92,
        q13_target_sectors_v2: ["industry"],
        q12_geo_zones: ["ile-de-france"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "industry",
        activity: "precision workshop",
        location: "ile-de-france",
        revenue_meur: 2,
      },
    )

    expect(result.score).toBe(91)
    expect(result.recommendation).toBe("strong_fit")
    expect(result.reasons).toContain("Sector or activity matches the repreneur target preference.")
  })

  it("caps the score when the repreneur is not ready enough", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 90,
        when_score: 30,
        q13_target_sectors_v2: ["services"],
        q12_geo_zones: ["pays-de-la-loire"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "services",
        location: "pays-de-la-loire",
        revenue_meur: 2,
      },
    )

    expect(result.score).toBe(55)
    expect(result.recommendation).toBe("weak_fit")
    expect(result.reasons).toContain("WHEN score is below 40, so this match is capped until readiness improves.")
  })

  it("caps the score when deal size is a clear mismatch", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 90,
        when_score: 92,
        q13_target_sectors_v2: ["healthcare"],
        q12_geo_zones: ["occitanie"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "healthcare",
        location: "occitanie",
        revenue_meur: 8,
      },
    )

    expect(result.score).toBe(60)
    expect(result.recommendation).toBe("weak_fit")
    expect(result.reasons).toContain("Opportunity size does not clearly match the repreneur target range.")
  })

  it("handles legacy string fields as well as array fields", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 80,
        when_score: 80,
        sector_preferences: "manufacturing",
        target_location: "grand-est",
        target_acquisition_size: "3-5M",
      },
      {
        sector: "manufacturing",
        location: "grand-est",
        revenue_meur: 4,
      },
    )

    expect(result.score).toBe(86)
    expect(result.recommendation).toBe("strong_fit")
  })
})
