import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { displayRepreneurOpportunityGeography } from "../repreneur-opportunity-geography"

const REPRENEUR_OPPORTUNITY_CARD_VARIANTS = [
  "components/opportunities/repreneur-opportunity-list.tsx",
  "components/opportunities/repreneur-opportunity-detail.tsx",
  "components/portal/repreneur-profile-summary.tsx",
]

describe("repreneur opportunity geography", () => {
  it("preserves a known geography label without inferring a more specific region", () => {
    expect(displayRepreneurOpportunityGeography("Grand Ouest")).toBe("Grand Ouest")
    expect(displayRepreneurOpportunityGeography(" Grand Ouest ")).toBe(" Grand Ouest ")
  })

  it("does not fabricate geography when none is known", () => {
    expect(displayRepreneurOpportunityGeography(null)).toBe("Geography to confirm")
    expect(displayRepreneurOpportunityGeography("")).toBe("Geography to confirm")
    expect(displayRepreneurOpportunityGeography("   ")).toBe("Geography to confirm")
  })

  it("uses the same literal-only presentation in every repreneur opportunity-card variant", () => {
    for (const path of REPRENEUR_OPPORTUNITY_CARD_VARIANTS) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8")
      expect(source).toContain("displayRepreneurOpportunityGeography")
    }
  })
})
