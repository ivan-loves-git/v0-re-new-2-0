import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  `${process.cwd()}/components/opportunities/opportunity-matches-panel.tsx`,
  "utf8",
)

describe("opportunity match add form contract", () => {
  it("offers only repreneurs without an existing match, because this form creates rather than edits", () => {
    expect(source).toContain(
      "const unsavedCandidates = candidates.filter((candidate) => !savedRepreneurIds.has(candidate.id))",
    )
    expect(source).toContain("const selectedCandidate = unsavedCandidates.find")
    expect(source).toContain("options={unsavedCandidates}")
    expect(source).toContain("disabled={unsavedCandidates.length === 0}")
  })
})
