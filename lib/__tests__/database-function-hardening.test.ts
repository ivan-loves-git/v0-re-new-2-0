import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migrationPath =
  `${process.cwd()}/scripts/102_database_function_hardening.sql`

describe("database function hardening migration", () => {
  it("pins every advisor-reported mutable function search path", () => {
    const migration = readFileSync(migrationPath, "utf8")
    const signatures = [
      "compute_journey_stage(integer, text)",
      "prevent_retained_opportunity_document_delete()",
      "reject_opportunity_pursuit_evidence_mutation()",
      "update_updated_at_column()",
      "reject_external_pursuit_audit_mutation()",
      "update_journey_stage_trigger()",
      "reject_external_pursuit_conversion_mutation()",
      "reject_opportunity_nda_artifact_mutation()",
    ]

    for (const signature of signatures) {
      expect(migration).toContain(
        `ALTER FUNCTION public.${signature} SET search_path TO public, pg_temp;`,
      )
    }
  })

  it("removes browser RPC execution from security-definer trigger functions", () => {
    const migration = readFileSync(migrationPath, "utf8")
    const signatures = [
      "assert_opportunity_nda_artifact_integrity()",
      "assert_opportunity_pursuit_evidence_integrity()",
      "reject_linked_nda_document_mutation()",
      "wave_journey_guard_opportunity_lifecycle()",
      "wave_journey_guard_repreneur_artifact_origin()",
    ]

    for (const signature of signatures) {
      expect(migration).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`,
      )
    }

    expect(migration).not.toContain("REVOKE EXECUTE ON FUNCTION public.compute_journey_stage")
    expect(migration).not.toContain("FROM service_role")
  })
})
