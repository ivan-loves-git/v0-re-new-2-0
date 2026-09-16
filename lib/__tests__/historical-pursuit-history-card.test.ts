import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { HistoricalPursuitHistoryTable } from "@/components/repreneurs/historical-pursuit-history-card"
import type { StaffHistoricalPursuitImportRow } from "@/lib/data/historical-pursuit-import"

vi.mock("@/lib/data/historical-pursuit-import", () => ({ listStaffHistoricalPursuitImportRows: vi.fn() }))

const fixture: StaffHistoricalPursuitImportRow = {
  sourceKey: "synthetic:71", sourceVersion: "V4", sourceRow: 71, offerLabel: null,
  opportunityReference: "Original reference", completedStages: [], notApplicableStages: [],
  lastReportedStage: "seller_meeting", rawDropReason: null, sourceTerminal: false,
  reviewFlags: [], appliedOutcome: "external_or_missing",
}
const renderRow = (overrides: Partial<StaffHistoricalPursuitImportRow>) => renderToStaticMarkup(
  createElement(HistoricalPursuitHistoryTable, { rows: [{ ...fixture, ...overrides }] }),
)

const component = readFileSync("components/repreneurs/historical-pursuit-history-card.tsx", "utf8")
const profilePage = readFileSync("app/(dashboard)/repreneurs/[id]/page.tsx", "utf8")

describe("staff historical pursuit history", () => {
  it("shows a confirmed confidential history row without an obsolete warning or a link", () => {
    const html = renderRow({ clarificationOutcome: "confidential_history" })
    expect(html).toContain("Confidential history only")
    expect(html).toContain("Not published in Deal Flow")
    expect(html).not.toContain("Review needed")
    expect(html).not.toContain("<a ")
  })

  it("retains the original reference alongside the corrected WAVE reference", () => {
    const html = renderRow({ clarificationOutcome: "linked_history", appliedOutcome: "created", resolvedReference: "Corrected reference" })
    expect(html).toContain("Original reference")
    expect(html).toContain("Confirmed WAVE reference: Corrected reference")
    expect(html).toContain("separate from validated WAVE progress")
  })

  it("explains reopening without claiming validated progress or access", () => {
    const html = renderRow({ clarificationOutcome: "reopened", appliedOutcome: "merged" })
    expect(html).toContain("Reopened through the audited workflow to Interested")
    expect(html).toContain("reported milestones do not grant access")
    expect(html).not.toContain("Staff review is needed before reopening")
    expect(renderRow({})).toContain("Review needed")
  })

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
