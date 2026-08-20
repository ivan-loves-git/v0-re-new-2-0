import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  `${process.cwd()}/components/repreneurs/repreneur-opportunity-matches-card.tsx`,
  "utf8",
)

describe("repreneur opportunity recommendation save feedback", () => {
  it("surfaces a returned server-action validation failure instead of treating it as success", () => {
    expect(source).toContain("const result = await saveOpportunityMatch(formData)")
    expect(source).toContain("if (!result.ok)")
    expect(source).toContain("setRecommendationError(result.message)")
  })

  it("acknowledges a persisted recommendation and prevents duplicate submits while pending", () => {
    expect(source).toContain("setRecommendationSuccess(\"Recommendation saved.\")")
    expect(source).toContain('disabled={isSaving}')
    expect(source).toContain('role="status"')
  })
})
