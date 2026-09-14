import { describe, expect, it } from "vitest"
import { verifyV4Readback, V4_SOURCE_SHA } from "../../scripts/pursuit-workbook-v4.mjs"

function fixture() {
  const rows = Array.from({ length: 72 }, (_, i) => ({
    sourceRow: i + 3, repreneurId: `buyer-${i}`, opportunityId: i < 57 ? `opp-${i}` : null,
    fingerprint: `source-${i}`, payloadDigest: `payload-${i}`, blockers: [], flags: [],
    completedSourceStages: ["interest_confirmed"], dropReason: i < 8 || (i >= 52 && i < 57) ? "Source withdrawal" : null,
  }))
  const records = rows.map((row, i) => ({ sourceRow: row.sourceRow, expectedMatchExists: i < 48,
    expectedMatchFingerprint: i < 48 ? `before-${i}` : null, changesExistingStatus: i < 8,
    laterApply: { action: i >= 57 ? "none" : i < 48 ? "merge_historical_match" : "create_historical_match", desiredStatus: row.dropReason ? "dropped" : "draft" },
  }))
  const beforeImages = rows.slice(0, 48).map((row, i) => ({ id: `match-${i}`, opportunity_id: row.opportunityId,
    repreneur_id: row.repreneurId, status: "draft", fingerprint: `before-${i}`, before_image: { id: `match-${i}`, status: "draft", human_notes: "Preserved" },
  }))
  const ledger = rows.map((row, i) => ({ id: `ledger-${i}`, source_row: row.sourceRow, source_sha256: V4_SOURCE_SHA,
    source_sheet: "Synthese", source_row_fingerprint: row.fingerprint, source_payload_digest: row.payloadDigest,
    manifest_digest: "manifest", event_dates_unknown: true, repreneur_id: row.repreneurId, opportunity_id: row.opportunityId,
    source_terminal: Boolean(row.dropReason), last_reported_source_stage: "interest_confirmed", resolution_blockers: [], review_flags: [],
    apply_outcome: i >= 57 ? "external_or_missing" : i < 48 ? "merged" : "created", match_id: i < 57 ? `match-${i}` : null,
    mapped_match_status: records[i].laterApply.desiredStatus, import_match_before: beforeImages[i]?.before_image ?? null,
    import_match_after_sha: i < 57 ? `after-${i}` : null,
  }))
  const matches = ledger.slice(0, 57).map((row) => ({ id: row.match_id, opportunity_id: row.opportunity_id,
    repreneur_id: row.repreneur_id, status: row.mapped_match_status, fingerprint: row.import_match_after_sha, no_workflow_evidence: true,
  }))
  return { approved: { rows, beforeImages, manifest: { records, manifestDigest: "manifest", existingDraftDrops: 8 } }, ledger, matches }
}

describe("V4 persisted readback", () => {
  it("proves every source row, before-image, current pair and outcome", () => {
    const f = fixture()
    expect(verifyV4Readback(f.approved, f.ledger, f.matches)).toEqual({ verifiedRows: 72,
      outcomes: { merged: 48, created: 9, external_or_missing: 15 }, guardedStatusChanges: 8, statusCorrectionsReversed: 0 })
  })
  it("rejects incomplete history, altered source facts and changed current records", () => {
    const f = fixture()
    expect(() => verifyV4Readback(f.approved, f.ledger.slice(1), f.matches)).toThrow(/incomplete/)
    f.ledger[71].source_payload_digest = "tampered"
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches)).toThrow(/source or resolution/)
    f.ledger[71].source_payload_digest = f.approved.rows[71].payloadDigest
    f.matches[56].fingerprint = "later-staff-change"
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches)).toThrow(/after-image changed/)
  })
  it("rejects fabricated workflow and altered retained before-images", () => {
    const f = fixture()
    f.matches[48].no_workflow_evidence = false
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches)).toThrow(/workflow\/access/)
    f.matches[48].no_workflow_evidence = true
    f.ledger[0].import_match_before = { id: "match-0", status: "draft", human_notes: "Overwritten" }
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches)).toThrow(/after-image changed/)
  })
  it("recognizes only the complete audited eight-status reversal", () => {
    const f = fixture()
    const reversals = f.ledger.slice(0, 8).map((row, i) => ({ ledger_id: row.id, match_id: row.match_id, before_sha: row.import_match_after_sha, after_sha: `reversed-${i}` }))
    reversals.forEach((row, i) => { f.matches[i].status = "draft"; f.matches[i].fingerprint = row.after_sha })
    expect(verifyV4Readback(f.approved, f.ledger, f.matches, reversals).statusCorrectionsReversed).toBe(8)
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches, reversals.slice(1))).toThrow(/incomplete status-reversal/)
    reversals[7].before_sha = "unrelated"
    expect(() => verifyV4Readback(f.approved, f.ledger, f.matches, reversals)).toThrow(/after-image changed/)
  })
})
