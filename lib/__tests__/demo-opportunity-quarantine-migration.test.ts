import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync(path.join(process.cwd(), "scripts/112_demo_opportunity_quarantine.sql"), "utf8")
const rehearsal = fs.readFileSync(path.join(process.cwd(), "scripts/rehearse-w126-demo-opportunity-quarantine.sh"), "utf8")
const rollbackArtifact = fs.readFileSync(path.join(process.cwd(), "scripts/rollback-w126-demo-opportunity-quarantine.sql"), "utf8")
const verifyWorkflow = fs.readFileSync(path.join(process.cwd(), ".github/workflows/verify.yml"), "utf8")

describe("W-126 DEMO quarantine migration", () => {
  it("uses an explicit default-false flag and a 24-record drift-checked manifest", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE")
    expect(migration).toContain("v_expected_rows CONSTANT INTEGER := 24")
    expect(migration).toContain("w126_demo_quarantine_identity_mismatch")
    expect(migration).toContain("w126_demo_quarantine_manifest_drift")
    expect(migration).toContain("expected_active_pursuits")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.w126_demo_opportunity_manifest()")
  })

  it("uses the shared service-only manifest for retry-safe apply and manifest-bound rollback", () => {
    for (const functionName of ["w126_demo_opportunity_manifest", "apply_w126_demo_opportunity_quarantine", "rollback_w126_demo_opportunity_quarantine"]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`)
    }
    expect(migration).toContain("w126_demo_quarantine_mixed_state")
    expect(migration).toContain("w126_demo_quarantine_retry_manifest_drift")
    expect(migration).toContain("w126_demo_quarantine_apply_actor_drift")
    expect(migration).toContain("w126_demo_quarantine_rollback_apply_actor_drift")
    expect(migration).toContain("w126_demo_quarantine_rollback_state_drift")
    expect(migration).toContain("w126_demo_quarantine_rollback_manifest_drift")
    expect(migration).toContain("JOIN pg_temp.w126_manifest")
    expect(migration).toContain("to_char(m.updated_at AT TIME ZONE 'UTC'")
    expect(migration).toContain("SET is_demo=FALSE, updated_by=v_rollback_actor")
    expect(rollbackArtifact).toContain("BEGIN;")
    expect(rollbackArtifact).toContain("'staff-confirmed-w126-backfill'")
    expect(rollbackArtifact).toContain("'staff-confirmed-w126-rollback'")
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

  it("qualifies the response RPC opportunity status against its table", () => {
    expect(migration).toContain(
      "FROM public.opportunities opportunity WHERE opportunity.id=v_match.opportunity_id AND opportunity.status='active' AND NOT opportunity.is_demo FOR UPDATE",
    )
    expect(migration).toContain(
      "status=p_status::public.opportunity_match_status",
    )
  })

  it("has a disposable rehearsal that proves trigger-safe retry, exact rollback, and atomic failures", () => {
    for (const proof of ["w126_success_result_mismatch", "w126_lifecycle_history_changed", "w126_label_inference_detected", "w126_drift_was_not_atomic", "w126_cardinality_was_accepted", "w126_retry_not_idempotent", "w126_retry_dependent_drift_accepted", "w126_apply_actor_drift_accepted", "w126_rollback_not_idempotent", "w126_rollback_state_drift_accepted", "w126_rollback_actor_drift_not_atomic", "w126_rollback_dependent_drift_accepted", "w126_rollback_manifest_drift_not_atomic", "w126_portal_response_write_failed"]) expect(rehearsal).toContain(proof)
    expect(rehearsal).toContain("771_public_schema.sql")
    expect(rehearsal).toContain("w126_full_schema_rpc_mismatch")
    expect(rehearsal).toContain("CREATE TYPE public.opportunity_match_status AS ENUM")
    expect(rehearsal).toContain("rehearsal_opportunity_updated_at")
    expect(rehearsal).toContain("w126_migration_transaction_control_forbidden")
    expect(rehearsal).toContain('${TMPDIR:-/tmp}/renew-w126-demo-quarantine.XXXXXX')
    expect(rehearsal).toContain("SELECT 1 FROM pg_roles WHERE rolname='postgres'")
    expect(rehearsal).not.toMatch(/\brg\s/)
    expect(verifyWorkflow).toContain("Rehearse W-126 DEMO quarantine and portal response")
    expect(verifyWorkflow).toContain("bash scripts/rehearse-w126-demo-opportunity-quarantine.sh")
  })
})
