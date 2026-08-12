import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const migration = readFileSync(
  `${root}/scripts/092_france_geography_and_mandate_references.sql`,
  "utf8",
)
const contract = readFileSync(
  `${root}/docs/data-models/ma-advisory-data-model-v1.md`,
  "utf8",
)

describe("W-039 Phase A/B and W-099 France geography and mandate references", () => {
  it("seeds only the approved France-first hierarchy with stable identities", () => {
    expect(migration).toContain("'france','FR','France','country',NULL")
    expect(migration).toContain("'fr-macro-idf','IDF','Île-de-France','macro_zone'")
    expect(migration).toContain("'fr-region-idf','IDF','Île-de-France','region'")
    expect(migration).toContain("w039_france_seed_count_mismatch")
    expect(migration).not.toContain("'Germany','country'")
    expect(contract).toContain("seeds only France (`FR`), six macro-zones and fourteen regions")
  })

  it("keeps literal legacy locations and historic references outside the new-record boundary", () => {
    expect(migration).toContain("intentionally does not backfill existing")
    expect(migration).toContain(
      "p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day']",
    )
    expect(migration).toContain("validate_w098_date_precision_write")
    expect(migration).toContain("opportunity_date_added_month_precision_requires_confirmation")
    expect(migration).toContain("opportunity_reference_is_immutable")
    expect(migration).not.toContain("UPDATE public.opportunities SET reference")
    expect(contract).toContain("Existing opportunities keep their literal `location` and reference")
  })

  it("requires a selected canonical geography only for creation and allocates a permanent per-code reference", () => {
    expect(migration).toContain("opportunity_geography_required")
    expect(migration).toContain("opportunity_mandate_reference_counters")
    expect(migration).toContain("ON CONFLICT (reference_code) DO UPDATE")
    expect(migration).toContain("RETURNING next_sequence - 1 INTO allocated")
    expect(migration).toContain("CASE WHEN allocated < 1000 THEN LPAD(allocated::TEXT, 3, '0') ELSE allocated::TEXT END")
    expect(migration).toContain("saved := public.create_opportunity_with_office_context_legacy")
    expect(migration).toContain("saved := public.save_opportunity_office_context_legacy")
    expect(contract).toContain("rollback consumes no number")
  })

  it("keeps geography and counter writes staff-service-only and prevents an unapproved adoption", () => {
    expect(migration).toContain("FORCE ROW LEVEL SECURITY")
    expect(migration).toContain("REVOKE ALL ON TABLE public.geography_nodes")
    expect(migration).toContain("public.create_opportunity_with_office_context(TEXT, UUID")
    expect(migration).toContain("TO service_role")
    expect(migration).toContain("w039_geography_source_hash_not_approved")
    expect(migration).toContain("w039_geography_live_opportunity_count_mismatch")
    expect(migration).toContain("w039_geography_location_changed_after_preflight")
    expect(migration).toContain("CREATE TEMP TABLE IF NOT EXISTS w039_rows")
    expect(migration).toContain("TRUNCATE TABLE w039_rows")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("JSONB_ARRAY_LENGTH(NEW.q12_geo_zones) > 0")
  })
})
