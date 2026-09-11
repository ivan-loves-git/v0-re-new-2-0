import { describe, expect, it } from "vitest"
import { getOpportunityInterestEmailCopy } from "@/lib/email/templates/locked-opportunity-interest"

describe("opportunity interest notification copy", () => {
  it("uses generic staff-validation copy for an unassigned opportunity", () => {
    const copy = getOpportunityInterestEmailCopy(false)

    expect(copy.heading).toBe("Nouvel intérêt repreneur")
    expect(copy.introduction).toContain("manifester son intérêt")
    expect(copy.followUp).toContain("qualifier cet intérêt")
    expect(copy.followUp).not.toContain("déjà active")
  })

  it("uses one-candidate wording only when the server found another active pursuit", () => {
    const copy = getOpportunityInterestEmailCopy(true)

    expect(copy.heading).toBe("Nouvel intérêt repreneur")
    expect(copy.followUp).toContain("qualifier cet intérêt")
    expect(copy.followUp).toContain("Une poursuite déjà active reste inchangée")
  })
})
