import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-062 canonical interaction persistence", () => {
  const migration = source("scripts/080_ma_interaction_persistence.sql")
  const workflow = source("lib/actions/ma-workflows.ts")
  const sendRoute = source(
    "app/api/opportunities/[id]/ma-workflow/send/route.ts",
  )
  const rehearsal = source("scripts/rehearse-ma-interaction-persistence.sql")
  const verifier = source("scripts/verify-ma-data-model-schema.sql")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
  const historyPanel = source(
    "components/opportunities/opportunity-ma-workflow-panel.tsx",
  )

  it("preserves the four-row legacy evidence set without a dual-write path", () => {
    expect(migration).toContain(
      "ma_interaction_legacy_manifest_requires_exactly_four_distinct_rows",
    )
    expect(migration).toContain("INSERT INTO public.ma_interactions")
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING")
    expect(migration).toContain("ma_interaction_legacy_migration_manifest")
    expect(migration).toContain("body_sha256")
    expect(migration).toContain(
      "ma_interaction_legacy_manifest_evidence_mismatch",
    )
    expect(migration).toContain("LOCK TABLE public.ma_source_interactions")
    expect(migration).toContain("affiliation.legacy_source_contact_id")
    expect(migration).toContain("affiliation.legacy_source_id")
    expect(migration).toContain("GRANT SELECT ON TABLE")
    expect(migration).toContain("public.ma_source_interactions")

    const actionStart = workflow.indexOf(
      "export async function sendMaSourceWorkflowEmailPayload",
    )
    const action = workflow.slice(actionStart)
    expect(action).toContain('"begin_ma_interaction_email_send"')
    expect(action).toContain('"finalize_ma_interaction_email_send"')
    expect(action).toContain("idempotencyKey")
    expect(action).toContain("Retry the same unchanged email within 23 hours")
    expect(action).toContain("fingerprintResendDeliveryRequest")
    expect(action).toContain("p_client_operation_key")
    expect(action).toContain("p_provider_request_fingerprint")
    expect(action).not.toContain("Promise.race")
    expect(action).not.toContain('.from("ma_interactions").insert')
    expect(action).not.toContain('.from("ma_source_interactions").insert')
    expect(action.indexOf('"begin_ma_interaction_email_send"')).toBeLessThan(
      action.indexOf("await sendIntermediaryEmail"),
    )
  })

  it("enforces staff-only same-office history and audited provisional ownership", () => {
    for (const required of [
      "ma_interaction_affiliation_must_match_office",
      "ma_interaction_opportunity_must_match_office",
      "owner_verification_state TEXT NOT NULL DEFAULT 'provisional'",
      "ma_interaction_owner_verification_events_are_append_only",
      "ma_interaction_delivery_events_are_append_only",
      "CREATE OR REPLACE FUNCTION public.verify_ma_interaction_owner",
      "CREATE OR REPLACE FUNCTION public.begin_ma_interaction_email_send",
      "CREATE OR REPLACE FUNCTION public.finalize_ma_interaction_email_send",
      "ma_interaction_owner_must_verify_self",
      "ma_interaction_history_blocks_source_office_change",
      "ma_source_office_change_blocked_during_email_send",
      "GRANT EXECUTE ON FUNCTION public.verify_ma_interaction_owner(UUID, TEXT) TO service_role;",
      "client_operation_key",
      "provider_request_fingerprint",
      "ma_interaction_email_replay_requires_exact_request",
      "ma_interaction_email_replay_window_expired",
    ]) {
      expect(migration).toContain(required)
    }

    expect(contract).toContain(
      "Migration 080 is a checked-in W-062 implementation candidate only",
    )
    expect(contract).toContain(
      "Attachments and general interaction create/edit UI remain deferred to W-066",
    )
    expect(historyPanel).toMatch(
      /interaction\.owner_verification_state\s*===\s*"provisional"/,
    )
    expect(historyPanel).toContain("Owner to verify")
    expect(historyPanel).toContain("sessionStorage")
    expect(historyPanel).toContain("crypto.randomUUID()")
    expect(historyPanel).toContain("clientOperationKey")
    expect(sendRoute).toContain("clientOperationKey")
  })

  it("keeps a production-shaped disposable migration rehearsal", () => {
    expect(rehearsal).toContain("\\ir 080_ma_interaction_persistence.sql")
    expect(rehearsal).toContain(
      "w062_same_office_affiliation_rejection_missing",
    )
    expect(rehearsal).toContain(
      "w062_same_office_opportunity_rejection_missing",
    )
    expect(rehearsal).toContain("w062_owner_verification_audit_failed")
    expect(rehearsal).toContain("w062_legacy_write_retirement_missing")
    expect(rehearsal).toContain("w062_browser_read_denial_missing")
    expect(rehearsal).toContain(
      "w062_canonical_failed_delivery_evidence_missing",
    )
    expect(rehearsal).toContain("w062_provider_delivery_event_evidence_missing")
    expect(rehearsal).toContain("w062_pending_delivery_duplicate_guard_missing")
    expect(rehearsal).toContain(
      "w062_same_operation_key_replay_created_duplicate",
    )
    expect(rehearsal).toContain(
      "w062_same_request_fingerprint_replay_created_duplicate",
    )
    expect(rehearsal).toContain(
      "w062_finalized_response_loss_replay_created_duplicate",
    )
    expect(rehearsal).toContain("w062_parent_office_move_guard_missing")
    expect(rehearsal).toContain("w062_reservation_source_move_guard_missing")
    expect(rehearsal).toContain("w062_direct_verified_insert_denial_missing")
    expect(rehearsal).toContain("w062_canonical_mutation_guard_missing")
    expect(rehearsal).toContain(
      "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions",
    )
    expect(rehearsal).toContain("w062_clean_rerun_failed")
    expect(rehearsal).not.toContain("DATABASE_URL")
    expect(verifier).toContain("'migrated_delivery_evidence'")
    expect(verifier).toContain("'canonical_service_can_write'")
    expect(verifier).toContain("'browser_interaction_access'")
    expect(verifier).toContain("'service_can_verify_owner'")
  })
})
