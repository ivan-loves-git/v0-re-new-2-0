import { describe, expect, it } from "vitest"
import { getOpportunityInterestEmailCopy } from "@/lib/email/templates/locked-opportunity-interest"

describe("opportunity interest notification copy", () => {
  it("uses generic staff-validation copy for an unassigned opportunity", () => {
    const copy = getOpportunityInterestEmailCopy(false)

    expect(copy.heading).toBe("Interest in an opportunity")
    expect(copy.introduction).toContain("currently unassigned")
    expect(copy.followUp).toContain("does not create an active pursuit")
    expect(copy.introduction).not.toContain("active pursuit")
  })

  it("uses one-candidate wording only when the server found another active pursuit", () => {
    const copy = getOpportunityInterestEmailCopy(true)

    expect(copy.heading).toBe("Interest on a positioned opportunity")
    expect(copy.introduction).toContain("already has an active pursuit")
    expect(copy.followUp).toContain("one-candidate-at-a-time")
  })
})
