import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20260825190000_w021_controlled_opportunity_publication.sql"), "utf8")
const preflight = readFileSync(path.join(process.cwd(), "scripts/run-w021-current-publication-preflight.sql"), "utf8")

describe("W-021 controlled opportunity publication contract", () => {
  it("keeps lifecycle separate and defaults future exposure to the existing staff-only intake path", () => {
    expect(migration).toContain("o.status = 'active' AND o.repreneur_exposure = 'staff_only' AND NOT o.is_demo")
    expect(migration).toContain("SET repreneur_exposure = 'anonymized'")
    expect(migration).not.toContain("SET status = 'active'")
    expect(migration).toContain("enforce_w021_new_opportunity_staff_only")
    expect(migration).toContain("NEW.repreneur_exposure := 'staff_only'")
  })

  it("allows only service-role audited publish and withdrawal with no pursuit or document mutation", () => {
    expect(migration).toContain("publish_w021_opportunity")
    expect(migration).toContain("withdraw_w021_opportunity")
    expect(migration).toContain("set_opportunity_broad_discovery_visibility")
    expect(migration).toContain("w021_opportunity_publication_events")
    expect(migration).toContain("REVOKE ALL ON FUNCTION")
    expect(migration).toContain("GRANT EXECUTE")
    expect(migration).not.toContain("UPDATE public.opportunity_matches")
    expect(migration).not.toContain("UPDATE public.opportunity_documents")
    expect(migration).not.toContain("UPDATE public.opportunity_nda_artifacts")
    expect(migration).toContain("REVOKE UPDATE ON TABLE public.opportunities FROM service_role")
    expect(migration).toContain("attribute.attname <> 'repreneur_exposure'")
    expect(migration).toContain("status = 'active' AND NOT is_demo")
  })

  it("rejects incomplete, demo, inactive, and legacy-exposure records", () => {
    for (const expected of [
      "public_title_missing", "teaser_summary_missing", "sector_missing", "location_missing",
      "source_office_inactive_or_missing", "primary_contact_not_exactly_one", "primary_email_unusable",
      "o.status = 'active' AND o.repreneur_exposure = 'staff_only' AND NOT o.is_demo",
    ]) expect(migration).toContain(expected)
  })

  it("binds the one-time bulk operation to the complete ordered current set and immutable evidence", () => {
    for (const expected of [
      "apply_w021_current_publication", "rollback_w021_current_publication", "FULL OUTER JOIN",
      "w021_bulk_manifest_set_mismatch", "w021_bulk_already_completed", "w021_bulk_rollback_manifest_drift",
      "w021_publication_audit_is_immutable", "w021_opportunity_publication_runs",
    ]) expect(migration).toContain(expected)
    expect(preflight).toContain("BEGIN READ ONLY")
    expect(preflight).toContain("w021_publication_manifest_digest")
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.w021_opportunity_publication_preflight(), public.w021_publication_manifest_digest(JSONB)",
    )
  })
})
