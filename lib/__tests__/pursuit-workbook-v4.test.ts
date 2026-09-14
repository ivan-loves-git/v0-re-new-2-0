import { describe, expect, it } from "vitest"
import { reconcilePursuitWorkbookV4, V4_SOURCE_SHA, V4_STAGES } from "../../scripts/pursuit-workbook-v4.mjs"

function fixture() {
  const rows = Array.from({ length: 72 }, (_, index) => ({
    sourceRow: index + 3, repreneurName: "Synthetic Buyer", offerLabel: "Synthetic offer",
    opportunityReference: `Re-New - IDF - ${String(index + 1).padStart(3, "0")}`,
    dropReason: index === 0 ? "Source reports withdrawal" : null,
    completedSourceStages: ["interest_confirmed"],
    notApplicableSourceStages: index === 0 ? V4_STAGES.slice(1) : [],
    sourceCells: Object.fromEntries(V4_STAGES.map((stage: string, i: number) => [stage, i === 0 ? "Oui" : index === 0 ? "N/A" : null])),
  }))
  return {
    source: { source: { sha256: V4_SOURCE_SHA, sheet: "Synthese" }, rows },
    snapshot: {
      repreneurs: [{ id: "buyer-1", first_name: "Synthetic", last_name: "Buyer", is_demo: false }],
      opportunities: rows.map((row, i) => ({ id: `opp-${i}`, reference: row.opportunityReference, status: "active", is_demo: false })),
      matches: [],
    },
  }
}

describe("V4 source-bound reconciliation", () => {
  it("prepares exact missing pairs as historical drafts/drops, never workflow evidence", () => {
    const { source, snapshot } = fixture()
    const result = reconcilePursuitWorkbookV4(source, snapshot)
    expect(result.records[0].laterApply).toEqual({ action: "create_historical_match", desiredStatus: "dropped" })
    expect(result.records[1].laterApply).toEqual({ action: "create_historical_match", desiredStatus: "draft" })
    expect(result.records[0].historicalProposal.dropReason).toBe("Source reports withdrawal")
    expect(result.records[0]).not.toHaveProperty("pursuit_stage")
    expect(result.records[0]).not.toHaveProperty("nda_status")
    expect(result.records).toHaveLength(72)
  })

  it("keeps archived, ambiguous, external and cross-namespace rows ledger-only", () => {
    const { source, snapshot } = fixture()
    snapshot.opportunities[0].status = "archived"
    snapshot.opportunities[1].is_demo = true
    snapshot.opportunities.push({ ...snapshot.opportunities[2], id: "duplicate-reference" })
    source.rows[3].opportunityReference = "External deal not in Deal Flow"
    const records = reconcilePursuitWorkbookV4(source, snapshot).records
    expect(records.slice(0, 4).map((row: { laterApply: { action: string } }) => row.laterApply.action)).toEqual(["none", "none", "none", "none"])
    expect(records[0].blockers).toEqual(["opportunity_not_active"])
    expect(records[1].blockers).toEqual(["namespace_mismatch"])
    expect(records[2].blockers).toEqual(["opportunity_reference_ambiguous"])
    expect(records[3].opportunity).toBeNull()
  })

  it("rejects impossible stage sequences or missing reasons instead of guessing", () => {
    const { source, snapshot } = fixture()
    source.rows[0].dropReason = null
    expect(() => reconcilePursuitWorkbookV4(source, snapshot)).toThrow(/reason/)
    source.rows[0].dropReason = "Source reports withdrawal"
    source.rows[1].sourceCells.nda_signed = "Oui"
    expect(() => reconcilePursuitWorkbookV4(source, snapshot)).toThrow(/sequence/)
  })

  it("rejects stale source identities and repeated source pairs", () => {
    const { source, snapshot } = fixture()
    source.source.sha256 = "old-workbook"
    expect(() => reconcilePursuitWorkbookV4(source, snapshot)).toThrow(/exact V4/)
    source.source.sha256 = V4_SOURCE_SHA
    source.rows[1].opportunityReference = source.rows[0].opportunityReference
    expect(() => reconcilePursuitWorkbookV4(source, snapshot)).toThrow(/Duplicate source pair/)
  })
})
