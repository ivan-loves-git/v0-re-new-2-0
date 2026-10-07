import { describe, expect, it } from "vitest"
import {
  isOpportunityClosureReason,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
} from "@/lib/types/opportunity"

describe("opportunity closure reasons", () => {
  it("accepts only the required canonical closure reasons", () => {
    expect(
      OPPORTUNITY_CLOSURE_REASON_OPTIONS.map((option) => option.value),
    ).toEqual([
      "stale",
      "sold",
      "signed_repreneur",
      "withdrawn_seller",
      "duplicate",
      "dd_disqualified",
    ])

    expect(isOpportunityClosureReason("stale")).toBe(true)
    expect(isOpportunityClosureReason("unknown")).toBe(false)
    expect(isOpportunityClosureReason("")).toBe(false)
    expect(isOpportunityClosureReason(null)).toBe(false)
  })

})
