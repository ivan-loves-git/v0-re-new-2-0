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

  it("treats sub-1M revenue as a deal-size mismatch against 1-3M+ targets", () => {
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
        location: "ile-de-france",
        revenue_meur: 0.6,
      },
    )

    expect(result.score).toBe(60)
    expect(result.recommendation).toBe("weak_fit")
    expect(result.reasons).toContain("Opportunity size does not clearly match the repreneur target range.")
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

  it("keeps the existing score unchanged when optional matching inputs are present", () => {
    const baseRepreneur = {
      who_score: 90,
      when_score: 92,
      q13_target_sectors_v2: ["industry"],
      q12_geo_zones: ["ile-de-france"],
      q14_deal_size: ["1-3M"],
    }
    const opportunity = {
      sector: "industry",
      location: "ile-de-france",
      revenue_meur: 2,
      ebitda_keur: 300,
      headcount: 24,
    }

    const withoutOptionalInputs = calculateOpportunityMatchScore(baseRepreneur, opportunity)
    const withOptionalInputs = calculateOpportunityMatchScore(
      {
        ...baseRepreneur,
        target_revenue_min_meur: 1.5,
        target_revenue_max_meur: 3,
        target_ebitda_margin_min_pct: 12,
        target_staff_size_min: 10,
        target_staff_size_max: 40,
      },
      opportunity,
    )

    expect(withOptionalInputs).toEqual(withoutOptionalInputs)
  })

  it("prefers canonical v2 criteria over stale legacy preferences", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 90,
        when_score: 92,
        q13_target_sectors_v2: ["services"],
        sector_preferences: ["industry"],
        q12_geo_zones: ["ile-de-france"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "industry",
        location: "ile-de-france",
        revenue_meur: 2,
      },
    )

    expect(result.reasons).toContain("Sector or activity is not clearly in the repreneur target preferences.")
  })

  it("keeps canonical Tech / Digital selections compatible with opportunity labels", () => {
    const result = calculateOpportunityMatchScore(
      {
        who_score: 80,
        when_score: 80,
        q13_target_sectors_v2: ["tech"],
        q12_geo_zones: ["all-france"],
        q14_deal_size: ["1-3M"],
      },
      {
        sector: "Digital/IT services",
        location: "Île-de-France",
        revenue_meur: 2,
      },
    )

    expect(result.reasons).toContain("Sector or activity matches the repreneur target preference.")
  })

  it("matches both successors of a broad legacy Services opportunity", () => {
    for (const target of ["Services aux entreprises (B2B)", "Services aux particuliers (B2C)"]) {
      const result = calculateOpportunityMatchScore(
        {
          who_score: 80,
          when_score: 80,
          q13_target_sectors_v2: [target],
          q12_geo_zones: ["all-france"],
          q14_deal_size: ["1-3M"],
        },
        {
          sector: "Services",
          location: "Île-de-France",
          revenue_meur: 2,
        },
      )

      expect(result.reasons).toContain("Sector or activity matches the repreneur target preference.")
    }
  })

  it("matches both successors of a broad legacy Santé target preference", () => {
    for (const sector of ["Industrie pharmaceutique & Dispositifs médicaux", "Services de santé"]) {
      const result = calculateOpportunityMatchScore(
        {
          who_score: 80,
          when_score: 80,
          q13_target_sectors_v2: ["healthcare"],
          q12_geo_zones: ["all-france"],
          q14_deal_size: ["1-3M"],
        },
        {
          sector,
          location: "Île-de-France",
          revenue_meur: 2,
        },
      )

      expect(result.reasons).toContain("Sector or activity matches the repreneur target preference.")
    }
  })
})
