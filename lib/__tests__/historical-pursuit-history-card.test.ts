import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const component = readFileSync("components/repreneurs/historical-pursuit-history-card.tsx", "utf8")
const profilePage = readFileSync("app/(dashboard)/repreneurs/[id]/page.tsx", "utf8")

describe("staff historical pursuit history", () => {
  it("is placed only in the staff repreneur opportunity view with a loading boundary", () => {
    expect(profilePage).toContain('import { Suspense, type ReactNode } from "react"')
    expect(profilePage).toContain("HistoricalPursuitHistoryCard")
    expect(profilePage).toContain("HistoricalPursuitHistoryLoading")
    expect(profilePage).not.toContain("portal/historical")
  })

  it("uses the narrow staff projection and does not render source internals", () => {
    expect(component).toContain("listStaffHistoricalPursuitImportRows")
    expect(component).toContain("Existing opportunity matches are unaffected")
    expect(component).not.toContain("source_cells")
    expect(component).not.toContain("source_repreneur_name")
    expect(component).not.toContain("manifest_digest")
    expect(component).not.toContain("payload_sha256")
    expect(component).not.toContain("linkedMatchId")
  })

  it("makes the historical boundary explicit", () => {
    expect(component).toContain("Dates are unknown")
    expect(component).toContain("do not create current NDA, document, or portal access")
    expect(component).toContain("Historical deal history is not available")
    expect(component).toContain("row.sourceTerminal")
  })
})
