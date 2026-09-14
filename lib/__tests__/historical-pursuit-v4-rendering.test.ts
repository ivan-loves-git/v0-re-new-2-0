import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/data/historical-pursuit-import", () => ({ listStaffHistoricalPursuitImportRows: vi.fn() }))
import { HistoricalPursuitHistoryTable } from "@/components/repreneurs/historical-pursuit-history-card"
import type { StaffHistoricalPursuitImportRow } from "@/lib/data/historical-pursuit-import"

const row: StaffHistoricalPursuitImportRow = {
  sourceKey: "v4:3", sourceVersion: "V4", sourceRow: 3, offerLabel: "Synthetic offer", opportunityReference: "SYNTHETIC-131",
  completedStages: ["interest_confirmed", "nda_received"], notApplicableStages: [], lastReportedStage: "nda_received",
  rawDropReason: null, sourceTerminal: false, reviewFlags: [], appliedOutcome: "merged",
}
const render = (record: StaffHistoricalPursuitImportRow) => renderToStaticMarkup(React.createElement(HistoricalPursuitHistoryTable, { rows: [record] }))

describe("V4 staff history rendering", () => {
  it("labels source-reported activity without claiming validated current stages or dates", () => {
    const html = render(row)
    expect(html).toContain("Pursuit V4")
    expect(html).toContain("Reported active")
    expect(html).toContain("Interest confirmed → NDA received")
    expect(html).toContain("No drop reported")
    expect(html).not.toContain("NDA signed")
  })
  it("shows both the original drop reason and protected-workflow explanation", () => {
    const html = render({ ...row, sourceTerminal: true, rawDropReason: "Source-reported withdrawal", reviewFlags: ["existing_draft_workflow_preserved"] })
    expect(html).toContain("Reported dropped")
    expect(html).toContain("Source-reported withdrawal")
    expect(html).toContain("Existing WAVE activity is preserved")
  })
  it("makes unresolved identities and contradictory current status explicit", () => {
    expect(render({ ...row, appliedOutcome: "external_or_missing" })).toContain("Review needed")
    expect(render({ ...row, reviewFlags: ["source_active_current_dropped"] })).toContain("WAVE remains Dropped")
  })
})
