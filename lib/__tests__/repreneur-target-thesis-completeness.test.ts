import { describe, expect, it } from "vitest"
import { automaticMatchingThesisCompleteness } from "@/lib/repreneur-target-thesis-completeness"

const completeThesis = {
  who_score: 72,
  when_score: 68,
  scoring_flags: [],
  q12_geo_zones: ["ile-de-france"],
  q13_target_sectors_v2: ["construction"],
  q14_deal_size: ["1-3M"],
}

describe("automatic target-thesis completeness", () => {
  it("accepts every current scorer dependency", () => {
    expect(automaticMatchingThesisCompleteness(completeThesis)).toEqual({ complete: true, missing: [] })
  })

  it.each([
    ["WHO score", { ...completeThesis, who_score: null }],
    ["WHEN score", { ...completeThesis, when_score: null }],
    ["matching flags", { ...completeThesis, scoring_flags: null }],
    ["geography", { ...completeThesis, q12_geo_zones: [] }],
    ["sectors", { ...completeThesis, q13_target_sectors_v2: [] }],
    ["deal size", { ...completeThesis, q14_deal_size: [] }],
  ])("reports a missing %s dependency", (expected, thesis) => {
    expect(automaticMatchingThesisCompleteness(thesis).missing).toContain(expected)
  })

  it("keeps legacy matching selections valid until a profile is edited", () => {
    expect(automaticMatchingThesisCompleteness({
      ...completeThesis,
      q12_geo_zones: [],
      q13_target_sectors_v2: [],
      q14_deal_size: [],
      target_location: ["ile-de-france"],
      sector_preferences: ["construction"],
      target_acquisition_size: "1-3M",
    })).toEqual({ complete: true, missing: [] })
  })

  it("does not turn optional financial context into a discovery gate", () => {
    expect(automaticMatchingThesisCompleteness({
      ...completeThesis,
      target_revenue_min_meur: null,
      target_revenue_max_meur: null,
      target_ebitda_margin_min_pct: null,
      target_staff_size_min: null,
      target_staff_size_max: null,
    })).toEqual({ complete: true, missing: [] })
  })
})
