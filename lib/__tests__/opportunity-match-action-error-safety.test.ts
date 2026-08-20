import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync(
  `${process.cwd()}/lib/actions/opportunity-matches.ts`,
  "utf8",
)

describe("opportunity match action error safety", () => {
  it("preserves only explicit form-validation messages and never exposes arbitrary Error text", () => {
    const actionFailure = source.match(/function actionFailure\(error: unknown\)[\s\S]*?\n}\n\nfunction readString/)

    expect(actionFailure?.[0]).toContain("error instanceof OpportunityMatchFormError")
    expect(actionFailure?.[0]).toContain('message: "Opportunity match update failed."')
    expect(actionFailure?.[0]).not.toContain("error instanceof Error")
  })

  it("maps the known active-pursuit uniqueness violation to a safe field error", () => {
    const lockedMatchError = source.match(/function lockedMatchError[\s\S]*?\n}\n\nfunction ensureStaffMatchStatus/)

    expect(lockedMatchError?.[0]).toContain("return formError(")
    expect(lockedMatchError?.[0]).toContain('"status"')
    expect(lockedMatchError?.[0]).not.toContain("error.message")
  })
})
