import { describe, expect, it } from "vitest"
import {
  normalizeIdentity,
  normalizedReference,
  reconcileHistoricalPursuits,
} from "../../scripts/historical-pursuit-manifest.mjs"

const baseRow = {
  sourceRow: 3,
  repreneurName: "David ISSAUTIER",
  offerLabel: "Deal Flow - Paid",
  opportunityReference: "Re-New - GO - 017",
  dropReason: "Issue with localization",
  completedSourceStages: ["interest_confirmed", "nda_signed"],
  notApplicableSourceStages: ["qa_with_ma_firm"],
}

function buildSource(rows = 60) {
  return {
  source: { sha256: "source-hash", sheet: "Synthese" },
  rows: [
    ...Array.from({ length: 46 }, (_, index) => ({
      ...baseRow,
      sourceRow: index + 3,
      opportunityReference: `Re-New - GO - ${String(index + 1).padStart(3, "0")}`,
    })),
    ...Array.from({ length: 14 }, (_, index) => ({
      ...baseRow,
      sourceRow: index + 49,
      opportunityReference: `External process ${index}`,
      notApplicableSourceStages: [],
    })),
  ].slice(0, rows),
  }
}
const source = buildSource()

const snapshot = {
  repreneurs: [{ id: "buyer-1", first_name: "David", last_name: "Issautier" }],
  opportunities: Array.from({ length: 46 }, (_, index) => ({
    id: `opportunity-${index + 1}`,
    reference: `Re-New - GO - ${String(index + 1).padStart(3, "0")}`,
  })),
  matches: Array.from({ length: 13 }, (_, index) => ({ opportunity_id: `opportunity-${index + 1}`, repreneur_id: "buyer-1" })),
}

describe("historical pursuit preflight manifest", () => {
  it("normalizes only canonical Re-New opportunity references", () => {
    expect(normalizeIdentity("François  Naimo")).toBe("francois naimo")
    expect(normalizedReference("Re-New - Idf - 7")).toBe("re-new-idf-007")
    expect(normalizedReference("Sanitas - not in deal flow")).toBeNull()
  })

  it("preserves resolved history as staff-review facts, not a live pursuit", () => {
    const manifest = reconcileHistoricalPursuits(source, snapshot)
    const record = manifest.records[0]

    expect(manifest.summary).toEqual({ resolved_for_staff_review: 46, unresolved_fail_closed: 14 })
    expect(manifest.safeApplySummary).toEqual({ merge_historical_match: 13, create_historical_match: 33, none: 14 })
    expect(record.resolution).toBe("resolved_for_staff_review")
    expect(record.historicalProposal).toMatchObject({
      disposition: "historical_dropped_or_closed",
      completedSourceStages: ["interest_confirmed", "nda_signed"],
    })
    expect(record).not.toHaveProperty("pursuit_stage")
    expect(record).not.toHaveProperty("nda_status")
    expect(record.laterApply).toEqual({ allowed: true, action: "merge_historical_match", desiredStatus: "dropped", currentMatchExists: true })
  })

  it("fails closed when a live canonical pair cannot be resolved", () => {
    expect(() => reconcileHistoricalPursuits(
      { ...source, rows: source.rows.map((row, index) => index === 0 ? { ...row, opportunityReference: "External seller process" } : row) },
      snapshot,
    )).toThrow("Approved workbook shape changed")
  })

  it("blocks ambiguous buyer identities rather than selecting one", () => {
    expect(() => reconcileHistoricalPursuits(source, {
      ...snapshot,
      repreneurs: [
        ...snapshot.repreneurs,
        { id: "buyer-2", first_name: "DAVID", last_name: "ISSAUTIER" },
      ],
    })).toThrow("Live mapping drift")
  })
})
