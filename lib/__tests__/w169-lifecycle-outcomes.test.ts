import { describe, expect, it } from "vitest"
import {
  isOpportunityClosureReason,
  isOpportunityPauseReason,
  isOpportunityPursuitDropReason,
  OPPORTUNITY_CLOSURE_REASON_OPTIONS,
  OPPORTUNITY_PAUSE_REASON_OPTIONS,
  OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS,
} from "@/lib/types/opportunity"

describe("W-169 lifecycle outcome separation", () => {
  it("keeps Drop, whole-sale Pause and permanent Close separate", () => {
    expect(OPPORTUNITY_CLOSURE_REASON_OPTIONS.map(({ value }) => value)).toEqual([
      "stale",
      "sold",
      "signed_repreneur",
      "withdrawn_seller",
      "duplicate",
      "dd_disqualified",
    ])
    expect(OPPORTUNITY_PAUSE_REASON_OPTIONS.map(({ value }) => value)).toEqual([
      "paused_cabinet",
      "seller_paused_sale",
      "exclusivity_another_buyer",
      "waiting_updated_information",
      "other",
    ])
    expect(
      OPPORTUNITY_PURSUIT_DROP_REASON_OPTIONS.map(({ value }) => value),
    ).not.toContain("no_viable_match")

    expect(isOpportunityClosureReason("paused_cabinet")).toBe(false)
    expect(isOpportunityClosureReason("no_viable_match")).toBe(false)
    expect(isOpportunityClosureReason("dd_disqualified")).toBe(true)
    expect(isOpportunityPauseReason("paused_cabinet")).toBe(true)
    expect(isOpportunityPauseReason("stale")).toBe(false)
    expect(isOpportunityPursuitDropReason("no_viable_match")).toBe(false)
    expect(isOpportunityPursuitDropReason("dd_disqualified_repreneur")).toBe(
      false,
    )
    expect(isOpportunityPursuitDropReason("dd_disqualified")).toBe(false)
    expect(
      OPPORTUNITY_CLOSURE_REASON_OPTIONS.find(
        ({ value }) => value === "dd_disqualified",
      )?.label,
    ).toBe("Due diligence — deal unsuitable for every repreneur")
  })

})
