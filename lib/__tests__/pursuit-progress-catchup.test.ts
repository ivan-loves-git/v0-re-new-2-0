import { describe, expect, it } from "vitest"
import { currentStageForStaffConfirmedHistory } from "@/lib/pursuit-progress-catchup"
import { deriveOpportunityJourney } from "@/lib/utils/opportunity-journey"
import { EXPECTED_STAGES } from "../../scripts/pursuit-progress-catchup.mjs"

describe("staff-confirmed pursuit progress", () => {
  it("keeps signed NDA and Q&A as explicit stages instead of relabelling them", () => {
    expect(currentStageForStaffConfirmedHistory("nda_signed")).toBe("nda_signed")
    expect(currentStageForStaffConfirmedHistory("qa_with_ma_firm")).toBe("qa_with_ma_firm")
  })

  it("projects the two new active-pursuit stages without granting a terminal state", () => {
    expect(deriveOpportunityJourney({ status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "nda_signed" }] })).toBe("nda_signed")
    expect(deriveOpportunityJourney({ status: "active", matches: [{ status: "active_pursuit", pursuit_stage: "qa_with_ma_firm" }] })).toBe("qa_with_ma_firm")
  })

  it("rejects source-only terminal markers as a current operating stage", () => {
    expect(currentStageForStaffConfirmedHistory("closing")).toBeNull()
  })

  it("pins the complete, duplicate-free 18-row V4 set", () => {
    expect([...EXPECTED_STAGES.keys()]).toEqual([11, 14, 21, 33, 34, 36, 38, 39, 40, 41, 50, 57, 58, 61, 62, 65, 68, 73])
    expect(new Set(EXPECTED_STAGES.keys()).size).toBe(18)
  })
})
