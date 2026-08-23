import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync(path.join(process.cwd(), "scripts/112_demo_opportunity_quarantine.sql"), "utf8")
const rehearsal = fs.readFileSync(path.join(process.cwd(), "scripts/rehearse-w126-demo-opportunity-quarantine.sh"), "utf8")

describe("W-126 DEMO quarantine migration", () => {
  it("uses an explicit default-false flag and a 24-record drift-checked manifest", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE")
    expect(migration).toContain("v_expected_rows CONSTANT INTEGER := 24")
    expect(migration).toContain("w126_demo_quarantine_identity_mismatch")
    expect(migration).toContain("w126_demo_quarantine_manifest_drift")
    expect(migration).toContain("expected_active_pursuits")
  })

  it("pins every authoritative portal RPC to NOT is_demo and keeps it service-only", () => {
    for (const functionName of [
      "express_opportunity_interest",
      "update_repreneur_opportunity_response",
      "journey_repreneur_can_access_confidential",
      "journey_repreneur_authorized_template",
      "journey_submit_repreneur_signed_copy",
      "claim_opportunity_memo_notification",
    ]) expect(migration).toContain(functionName)
    expect((migration.match(/NOT (?:o\.|opportunity\.)?is_demo/g) ?? []).length).toBeGreaterThanOrEqual(6)
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("TO service_role")
  })

  it("has a disposable rehearsal that proves success, retention, no label inference, drift, and cardinality failure", () => {
    for (const proof of ["w126_success_result_mismatch", "w126_lifecycle_history_changed", "w126_label_inference_detected", "w126_drift_was_not_atomic", "w126_cardinality_was_accepted"]) expect(rehearsal).toContain(proof)
    expect(rehearsal).toContain("771_public_schema.sql")
    expect(rehearsal).toContain("w126_full_schema_rpc_mismatch")
  })
})
