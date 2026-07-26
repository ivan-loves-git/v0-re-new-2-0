import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()
const migrationPath = "scripts/078_ma_cutover_staging_and_activation.sql"
const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("M&A one-time cutover staging migration", () => {
  const migration = source(migrationPath)
  const contract = source(contractPath)

  it("creates service-role-only staging without raw workbook storage", () => {
    for (const table of [
      "public.ma_cutover_runs",
      "public.ma_cutover_stage_rows",
      "public.ma_cutover_stage_issues",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
    }

    expect(migration).toContain("source_fingerprint TEXT NOT NULL")
    expect(migration).toContain("source_hash TEXT NOT NULL")
    expect(migration).not.toContain("BYTEA")
    expect(migration).not.toContain("raw_workbook")
    expect(migration).toContain("temporary_entity_id TEXT NOT NULL")
    expect(migration).toContain("parent_temporary_entity_id TEXT")
    expect(migration).toContain("related_temporary_entity_ids JSONB")
    expect(migration).toContain("resolution_action TEXT NOT NULL")
    expect(migration).toContain("reuse_canonical_id UUID")
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;")
    expect(migration).toContain("source_hash ~ '^[0-9a-f]{64}$'")
    expect(migration).toContain("CHAR_LENGTH(source_hash) = 64")
    expect(migration).toContain("CHAR_LENGTH(source_fingerprint) = 71")
    expect(migration).toContain("source_fingerprint ~ '^sha256:[0-9a-f]{64}$'")
    expect(migration).not.toContain("source_fingerprint ~ '^[A-Za-z0-9]")
    expect(migration).toContain("idx_ma_cutover_stage_issues_run_id")
    expect(migration).toContain("idx_ma_cutover_stage_issues_stage_row_id")
  })

  it("recomputes the approval digest in PostgreSQL from a deterministic reviewed snapshot", () => {
    const digest = migration.match(
      /CREATE OR REPLACE FUNCTION public\.compute_ma_cutover_approval_digest\([\s\S]*?\n\$\$;/,
    )?.[0]

    expect(digest).toBeDefined()
    expect(digest).toContain("RETURNS TEXT")
    expect(digest).toContain("STABLE")
    expect(digest).toContain("'source_fingerprint', run.source_fingerprint")
    expect(digest).toContain("'source_hash', run.source_hash")
    expect(digest).toContain("'reconciliation_summary', run.reconciliation_summary")
    expect(digest).toContain("'review_decisions', run.review_decisions")
    expect(digest).toContain("ORDER BY row.entity_kind, row.temporary_entity_id, row.id")
    expect(digest).toContain("COALESCE(issue.stage_row_id::TEXT, '')")
    expect(digest).toContain("'resolved_at_epoch_us', CASE")
    expect(digest).toContain("EXTRACT(EPOCH FROM issue.resolved_at) * 1000000")
    expect(digest).not.toContain("'resolved_at', issue.resolved_at")
    expect(digest).toContain("'version', 'ma-cutover-approval-digest-v1'")
    expect(digest).toContain("extensions.digest(digest_input::TEXT, 'sha256')")

    const runGuard = migration.match(
      /CREATE OR REPLACE FUNCTION public\.guard_ma_cutover_run_immutability\(\)[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(runGuard).toBeDefined()
    expect(
      runGuard?.match(
        /computed_digest := public\.compute_ma_cutover_approval_digest\(NEW\.id\);/g,
      ),
    ).toHaveLength(1)
    expect(runGuard).toContain("ma_cutover_supplied_approval_digest_mismatch")
    expect(runGuard).toContain("NEW.approval_digest := computed_digest")
  })

  it("binds approval to immutable staging and locks activation before mutation", () => {
    expect(migration).toContain("approval_digest")
    expect(migration).toContain("p_approval_digest TEXT")
    expect(migration).toContain("ma_cutover_activation_digest_mismatch")
    expect(migration).toContain("ma_cutover_stored_approval_digest_mismatch")
    expect(migration).toContain("ma_cutover_approval_digest_is_immutable")
    expect(migration).toContain("ma_cutover_approved_manifest_is_immutable")
    expect(migration).toContain("ma_cutover_approval_has_unresolved_blockers")
    expect(migration).toContain("ma_cutover_stage_is_immutable_after_approval")
    expect(migration).toContain("ma_cutover_run_has_unresolved_blockers")
    expect(migration).toContain("issue.severity = 'blocker'")
    expect(migration).toContain("issue.resolved_at IS NULL")
    expect(migration).toContain("ma_cutover_activation_count_reconciliation_failed")

    const activation = migration.match(
      /CREATE OR REPLACE FUNCTION public\.activate_ma_cutover_run\([\s\S]*?\n\$\$;/,
    )?.[0]
    expect(activation).toBeDefined()
    expect(
      activation?.match(
        /computed_approval_digest := public\.compute_ma_cutover_approval_digest\(run_row\.id\);/g,
      ),
    ).toHaveLength(1)
    expect(activation).toContain("CREATE TEMP TABLE IF NOT EXISTS ma_cutover_activation_guard")
    expect(activation?.indexOf("FROM public.ma_cutover_stage_rows row")).toBeLessThan(
      activation?.indexOf(
        "computed_approval_digest := public.compute_ma_cutover_approval_digest(run_row.id);",
      ) ?? -1,
    )
    expect(activation?.indexOf("FROM public.ma_cutover_stage_issues issue")).toBeLessThan(
      activation?.indexOf(
        "computed_approval_digest := public.compute_ma_cutover_approval_digest(run_row.id);",
      ) ?? -1,
    )
    expect(
      activation?.indexOf(
        "computed_approval_digest := public.compute_ma_cutover_approval_digest(run_row.id);",
      ),
    ).toBeLessThan(
      activation?.indexOf("CREATE TEMP TABLE IF NOT EXISTS ma_cutover_activation_guard") ?? -1,
    )
    expect(
      activation?.indexOf("CREATE TEMP TABLE IF NOT EXISTS ma_cutover_activation_guard"),
    ).toBeLessThan(activation?.indexOf("status = 'activating'") ?? -1)
  })

  it("keeps the stage-mutation trigger function structurally well-formed", () => {
    const guard = migration.match(
      /CREATE OR REPLACE FUNCTION public\.guard_ma_cutover_stage_mutation\(\)[\s\S]*?\n\$\$;/,
    )?.[0]

    expect(guard).toBeDefined()
    expect(guard).toMatch(/RETURN NEW;\s*END;\s*\$\$;/)
    expect(guard).not.toMatch(/RETURN NEW;\s*END;\s*END;\s*\$\$;/)
    expect(guard).toContain("ma_cutover_stage_run_id_is_immutable")
    expect(guard).toContain("FOR UPDATE;")
    expect(guard).not.toContain("FOR KEY SHARE;")
    expect(guard).toContain("ma_cutover_stage_delete_requires_activation_guard")
    expect(guard).toContain("ma_cutover_supersession_guard_present")
    expect(guard).toMatch(
      /IF run_status IN \('approved', 'activated', 'superseded'\) THEN[\s\S]*?END IF;\s*\n\s*RETURN OLD;/,
    )
  })

  it("prevents direct lifecycle and manifest deletion bypasses while retaining a controlled supersession purge", () => {
    const runGuard = migration.match(
      /CREATE OR REPLACE FUNCTION public\.guard_ma_cutover_run_immutability\(\)[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(runGuard).toBeDefined()
    expect(runGuard).toContain("ma_cutover_lifecycle_transition_requires_activation")
    expect(runGuard).toContain("ma_cutover_lifecycle_transition_requires_supersession")
    expect(runGuard).toContain("ma_cutover_activation_evidence_requires_activation")
    expect(runGuard).toContain("ma_cutover_supersession_evidence_requires_supersession")
    expect(runGuard).toContain("ma_cutover_approved_status_is_immutable")
    expect(runGuard).toContain("ma_cutover_closed_run_is_immutable")
    expect(migration).toContain("ma_cutover_run_must_start_open")
    expect(migration).toContain("ma_cutover_run_must_start_without_lifecycle_evidence")
    expect(migration).toContain("CREATE TRIGGER guard_ma_cutover_run_insert")
    expect(migration).toContain("ma_cutover_runs_are_never_deletable")
    expect(migration).toContain("CREATE TRIGGER prevent_ma_cutover_run_delete")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.supersede_ma_cutover_run(")
    expect(migration).toContain("CREATE TEMP TABLE IF NOT EXISTS ma_cutover_supersession_guard")
    expect(migration).toContain("ma_cutover_supersession_requires_open_run")
    expect(migration).toContain("'stage_rows_purged', purged_stage_rows")
    expect(migration).toContain("'stage_issues_purged', purged_stage_issues")
  })

  it("bounds temporary evidence and retains only sanitized aggregate manifest fields", () => {
    for (const helper of [
      "ma_cutover_bounded_flat_object",
      "ma_cutover_related_ids_are_bounded",
      "ma_cutover_payload_is_sanitized",
      "ma_cutover_locator_is_sanitized",
      "ma_cutover_reconciliation_is_sanitized",
      "ma_cutover_review_decisions_are_sanitized",
      "ma_cutover_result_is_sanitized",
    ]) {
      expect(migration).toContain(`public.${helper}`)
    }
    expect(migration).toContain("pg_column_size(p_value) > p_max_bytes")
    expect(migration).toContain("    8192,\n    2048")
    expect(migration).toContain("'sourceWorkbookId', 'sourceSheet', 'sourceRow', 'sourceKey'")
    expect(migration).toContain("'primaryAffiliationTemporaryId'")
    expect(migration).toContain("temporary_entity_id ~ '^[A-Za-z0-9][-A-Za-z0-9._:/@+]{0,159}$'")
    expect(migration).toContain("parent_temporary_entity_id ~ '^[A-Za-z0-9][-A-Za-z0-9._:/@+]{0,159}$'")
    expect(migration).toContain("CHECK (public.ma_cutover_reconciliation_is_sanitized(reconciliation_summary))")
    expect(migration).toContain("CHECK (public.ma_cutover_review_decisions_are_sanitized(review_decisions))")
    expect(migration).toContain("public.ma_cutover_result_is_sanitized(result_summary)")
    expect(migration).toContain("UNIQUE (run_id, id)")
    expect(migration).toContain("FOREIGN KEY (run_id, stage_row_id)")
    expect(migration).toContain(
      "REFERENCES public.ma_cutover_stage_rows (run_id, id)",
    )
    expect(migration).toContain("MATCH SIMPLE\n    ON DELETE CASCADE")
    expect(migration).not.toContain(
      "stage_row_id UUID REFERENCES public.ma_cutover_stage_rows(id)",
    )
  })

  it("requires an explicit reviewed create-or-reuse resolution", () => {
    expect(migration).toContain("resolution_action IN ('create', 'reuse')")
    expect(migration).toContain("ma_cutover_stage_firm_collision_requires_explicit_reuse")
    expect(migration).toContain("ma_cutover_stage_office_collision_requires_explicit_reuse")
    expect(migration).toContain("ma_cutover_stage_contact_collision_requires_explicit_reuse")
    expect(migration).toContain("ma_cutover_stage_affiliation_collision_requires_explicit_reuse")
    expect(migration).toContain("ma_cutover_stage_contact_reuse_resolution_invalid")

    const firmCreateCollision = migration.match(
      /FROM public\.ma_firms firm\s+WHERE LOWER\(BTRIM\(firm\.name\)\) = LOWER\(normalized_name\)[\s\S]*?ma_cutover_stage_firm_collision_requires_explicit_reuse/,
    )?.[0]
    expect(firmCreateCollision).toBeDefined()
    expect(firmCreateCollision).not.toContain("firm.status <> 'archived'")
    expect(migration).toContain(
      "pg_catalog.hashtextextended(LOWER(BTRIM(normalized_name)), 76061)",
    )
  })

  it("treats a synthetic default as an explicit unknown-office fallback", () => {
    expect(migration).toContain("'isSyntheticDefault'")
    expect(migration).toContain(
      "ma_cutover_stage_office_synthetic_default_boolean_required",
    )
    expect(migration).toContain(
      "ma_cutover_stage_synthetic_default_must_use_firm_name",
    )
    expect(migration).toContain(
      "ma_cutover_stage_synthetic_default_requires_unknown_office",
    )
    expect(migration).toContain("JOIN pg_temp.ma_cutover_identity_map staged_parent_firm")
    expect(migration).toContain(
      "staged_parent_firm.canonical_id = resolved_firm_id",
    )
    expect(migration).toContain("staged_office.id <> stage_row.id")
    expect(migration).not.toContain("->> 'isDefault'")
  })

  it("uses the canonical W-061 primitives and purges staging atomically", () => {
    expect(migration).toContain("create_or_affiliate_ma_contact")
    expect(migration).toContain("create_opportunity_with_office_context")
    expect(migration).toContain("assert_opportunity_office_context")
    expect(migration).toContain("DELETE FROM public.ma_cutover_stage_issues")
    expect(migration).toContain("DELETE FROM public.ma_cutover_stage_rows")
    expect(migration).toContain("'staging_purged', TRUE")
    expect(migration).not.toContain("ma_sources")
    expect(migration).not.toContain("source_label")
    expect(migration).not.toContain("origin_channel")
    expect(migration).not.toContain("p_repreneur_exposure")
  })

  it("preserves the full staged affiliation set and keeps the primary inside it", () => {
    expect(migration).toContain(
      "JSONB_ARRAY_ELEMENTS_TEXT(stage_row.related_temporary_entity_ids)",
    )
    expect(migration).toContain(
      "resolved_primary_affiliation_id = ANY(resolved_affiliation_ids)",
    )
  })

  it("passes only explicitly staged and manifest-approved optional fields", () => {
    expect(migration).toContain("approved_opportunity_fields")
    expect(migration).toContain("ma_cutover_approved_optional_fields_must_be_array")
    expect(migration).toContain(
      "ma_cutover_approved_optional_fields_contains_unsupported_key",
    )
    for (const field of [
      "'sector'",
      "'activity'",
      "'location'",
      "'revenue_meur'",
      "'ebitda_keur'",
      "'headcount'",
      "'headcount_range'",
      "'date_added'",
      "'public_title'",
      "'teaser_summary'",
      "'internal_notes'",
    ]) {
      expect(migration).toContain(field)
    }
    expect(migration).not.toContain("location_write_approved")
    for (const exception of [
      "ma_cutover_stage_revenue_meur_invalid",
      "ma_cutover_stage_ebitda_keur_invalid",
      "ma_cutover_stage_headcount_invalid",
      "ma_cutover_stage_date_added_invalid",
    ]) {
      expect(migration).toContain(exception)
    }
  })

  it("keeps the opportunity office mapping and contact lock declarations singular", () => {
    expect(migration).toMatch(/normalized_contact_key TEXT;/)
    const officeMap = migration.match(
      /SELECT map\.canonical_id\s+INTO resolved_office_id\s+FROM pg_temp\.ma_cutover_identity_map map[\s\S]*?;\n\n    SELECT ARRAY_AGG/,
    )?.[0]

    expect(officeMap).toBeDefined()
    expect(
      officeMap?.match(
        /map\.temporary_entity_id = stage_row\.parent_temporary_entity_id/g,
      ),
    ).toHaveLength(1)
  })

  it("keeps browser roles out of the security-invoker activation path", () => {
    expect(migration).toContain("SECURITY INVOKER")
    expect(migration).not.toContain("SECURITY DEFINER")
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.activate_ma_cutover_run(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;",
    )
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.activate_ma_cutover_run(UUID, TEXT, TEXT) TO service_role;",
    )
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.supersede_ma_cutover_run(UUID, TEXT) TO service_role;",
    )
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.activate_ma_cutover_run[\s\S]*TO (anon|authenticated)/i,
    )
  })

  it("keeps the canonical contract synchronized with W-020 retention and route boundaries", () => {
    expect(contract).toContain("Migration 078 is an unapplied cutover foundation")
    expect(contract).toContain("immutable approval digest")
    expect(contract).toContain(
      "no raw workbook bytes, file names, workbook IDs or Excel identifiers",
    )
    expect(contract).toContain("synthetic rehearsal only")
    expect(contract).toContain("WAVE does not infer a geography code")
    expect(contract).toContain("matching name, email or office never auto-reuses")
    expect(contract).toContain("approved_opportunity_fields")
    expect(contract).toContain("W-020 and migration 078")
    expect(contract).toContain("PostgreSQL recomputes that digest")
    expect(contract).toContain("controlled supersession")
    expect(contract).toContain("Gate 2 must execute migration 078")
    expect(contract).toContain("UTC-stable epoch microseconds")
    expect(contract).toContain("UTC and Europe/Rome session time zones")
    expect(contract).toContain("sha256:<64 lowercase hexadecimal characters>")
    expect(contract).toContain("same-run composite foreign key")
    expect(contract).toContain("arbitrary raw SQL with service-role database credentials")
    expect(contract).toContain("concurrent stage-mutation and supersession attempt")
  })
})
