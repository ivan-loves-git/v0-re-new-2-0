import { describe, expect, it } from "vitest"
import { automaticMatchingThesisCompleteness } from "@/lib/repreneur-target-thesis-completeness"

const completeThesis = {
  q12_geo_zones: ["ile-de-france"],
  q13_target_sectors_v2: ["construction"],
  target_revenue_min_meur: 1,
}

describe("automatic target-thesis completeness", () => {
  it("requires sector, geography, and at least one Matching v2 numeric target", () => {
    expect(automaticMatchingThesisCompleteness(completeThesis)).toEqual({
      complete: true,
      missing: [],
    })
  })

  it.each([
    ["geography", { ...completeThesis, q12_geo_zones: [] }],
    ["sectors", { ...completeThesis, q13_target_sectors_v2: [] }],
    ["financial or size target", {
      ...completeThesis,
      target_revenue_min_meur: null,
    }],
  ])("reports a missing %s dependency", (expected, thesis) => {
    expect(automaticMatchingThesisCompleteness(thesis).missing).toContain(expected)
  })

  it("keeps recognized legacy sector and geography selections valid", () => {
    expect(automaticMatchingThesisCompleteness({
      q12_geo_zones: [],
      q13_target_sectors_v2: [],
      target_location: ["ile-de-france"],
      sector_preferences: ["construction"],
      target_ebitda_margin_min_pct: 12,
    })).toEqual({ complete: true, missing: [] })
  })

  it.each([
    { target_revenue_min_meur: 1 },
    { target_revenue_max_meur: 5 },
    { target_ebitda_margin_min_pct: 10 },
    { target_staff_size_min: 5 },
    { target_staff_size_max: 100 },
  ])("accepts each supported numeric target as the initial size signal", (target) => {
    expect(automaticMatchingThesisCompleteness({
      q12_geo_zones: ["all-france"],
      q13_target_sectors_v2: ["industry"],
      ...target,
    }).complete).toBe(true)
  })

  it("does not use WHO, WHEN, flags, or the old deal-size bucket as a gate", () => {
    expect(automaticMatchingThesisCompleteness({
      ...completeThesis,
      who_score: null,
      when_score: null,
      scoring_flags: null,
      q14_deal_size: [],
    })).toEqual({ complete: true, missing: [] })
  })
})
