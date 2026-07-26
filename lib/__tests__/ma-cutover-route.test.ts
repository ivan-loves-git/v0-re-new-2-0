import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("M&A cutover rehearsal route", () => {
  it("is staff-gated and exposes only the fixed synthetic rehearsal", () => {
    const page = source("app/(dashboard)/opportunities/import/page.tsx")
    const review = source(
      "components/opportunities/opportunity-import-review.tsx",
    )

    expect(page).toContain("await requireStaffAccess()")
    expect(page).toContain("getSyntheticMaCutoverRehearsal")
    expect(review).toContain("Real cutover input is not enabled")
    expect(review).toContain("accepts neither files nor pasted rows")
    expect(review).not.toContain('type="file"')
    expect(review).not.toContain("Textarea")
    expect(review).not.toContain("Input")
    expect(review).not.toContain("FormData")
    expect(review).not.toContain("previewOpportunityImport")
    expect(review).not.toContain("commitOpportunityImport")
  })

  it("does not expose an activation server action or browser-writable staging path", () => {
    const action = source("lib/actions/opportunity-import.ts")

    expect(action).toContain("await requireStaffAccess()")
    expect(action).toContain("directOpportunityImportDisabled")
    expect(action).not.toContain("createAdminClient")
    expect(action).not.toContain("activate_ma_cutover_run")
    expect(action).not.toContain(".rpc(")
  })
})
