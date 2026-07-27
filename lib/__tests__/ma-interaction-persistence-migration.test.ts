import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-062 canonical interaction persistence", () => {
  const migration = source("scripts/080_ma_interaction_persistence.sql")
  const workflow = source("lib/actions/ma-workflows.ts")
  const rehearsal = source("scripts/rehearse-ma-interaction-persistence.sql")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
  const historyPanel = source("components/opportunities/opportunity-ma-workflow-panel.tsx")

  it("preserves the four-row legacy evidence set without a dual-write path", () => {
    expect(migration).toContain("ma_interaction_legacy_manifest_requires_exactly_four_distinct_rows")
    expect(migration).toContain("INSERT INTO public.ma_interactions")
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING")
    expect(migration).toContain("ma_interaction_legacy_migration_manifest")
    expect(migration).toContain("body_sha256")
    expect(migration).toContain("ma_interaction_legacy_manifest_evidence_mismatch")
    expect(migration).toContain("GRANT SELECT ON TABLE")
    expect(migration).toContain("public.ma_source_interactions")

    const actionStart = workflow.indexOf("export async function sendMaSourceWorkflowEmailPayload")
    const action = workflow.slice(actionStart)
    expect(action).toContain('.from("ma_interactions").insert')
    expect(action).not.toContain('.from("ma_source_interactions").insert')
    expect(action).toContain("delivery_status: status")
    expect(action).toContain("delivery_error: result.success")
  })

  it("enforces staff-only same-office history and audited provisional ownership", () => {
    for (const required of [
      "ma_interaction_affiliation_must_match_office",
      "ma_interaction_opportunity_must_match_office",
      "owner_verification_state TEXT NOT NULL DEFAULT 'provisional'",
      "ma_interaction_owner_verification_events_are_append_only",
      "CREATE OR REPLACE FUNCTION public.verify_ma_interaction_owner",
      "ma_interaction_owner_must_verify_self",
      "GRANT EXECUTE ON FUNCTION public.verify_ma_interaction_owner(UUID, TEXT) TO service_role;",
    ]) {
      expect(migration).toContain(required)
    }

    expect(contract).toContain("Migration 080 is a checked-in W-062 implementation candidate only")
    expect(contract).toContain("Attachments and general interaction create/edit UI remain deferred to W-066")
    expect(historyPanel).toContain('interaction.owner_verification_state === "provisional"')
    expect(historyPanel).toContain("Owner to verify")
  })

  it("keeps a production-shaped disposable migration rehearsal", () => {
    expect(rehearsal).toContain("\\ir 080_ma_interaction_persistence.sql")
    expect(rehearsal).toContain("w062_same_office_affiliation_rejection_missing")
    expect(rehearsal).toContain("w062_same_office_opportunity_rejection_missing")
    expect(rehearsal).toContain("w062_owner_verification_audit_failed")
    expect(rehearsal).toContain("w062_legacy_write_retirement_missing")
    expect(rehearsal).toContain("w062_browser_read_denial_missing")
    expect(rehearsal).toContain("w062_canonical_failed_delivery_evidence_missing")
    expect(rehearsal).toContain("w062_canonical_mutation_guard_missing")
    expect(rehearsal).toContain("w062_clean_rerun_failed")
    expect(rehearsal).not.toContain("DATABASE_URL")
  })
})
