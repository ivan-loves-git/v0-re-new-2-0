import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/092_france_geography_and_mandate_references.sql")
const rehearsal = source("scripts/rehearse-france-geography-and-mandate-references.sql")
const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
const repreneurPortal = source("lib/actions/repreneur-opportunities.ts")
const adoptionPreflight = source("scripts/prepare-w039-geography-adoption.mjs")
const adoptionRehearsal = source("scripts/rehearse-w039-geography-adoption.mjs")
const profileSyncRehearsal = source("scripts/rehearse-w039-repreneur-geography-sync.sh")
const localReplayRehearsal = source("scripts/rehearse-w039-adoption-replay.sh")

describe("W-039 Phase A/B and W-099 geography and references", () => {
  it("seeds only the approved France-first hierarchy with stable IDs and duplicate-readable-code safety", () => {
    expect(migration).toContain("w039_france_seed_count_mismatch")
    expect(migration).toContain("w039_france_seed_identity_mismatch")
    expect(migration).toContain("<> 21")
    expect(migration).toContain(
      "AS expected(id, stable_key, code, label, node_level, parent_id)",
    )
    expect(migration).toContain("'france','FR','France','country'")
    expect(migration).toContain("'fr-region-idf','IDF','Île-de-France','region'")
    expect(migration).not.toContain("'europe','EUR','Europe'")
    expect(migration).not.toContain("'germany','DE','Allemagne'")
    expect(migration).not.toContain("code TEXT NOT NULL UNIQUE")
    expect(rehearsal).toContain("w039_rehearsal_duplicate_readable_code")
  })

  it("keeps geography staff-only, adopts only reviewed source rows, and preserves literal locations", () => {
    expect(migration).toContain("geography_node_id UUID")
    expect(migration).toContain("ma_w039_geography_adoption_evidence")
    expect(migration).toContain("w039_geography_location_changed_after_preflight")
    expect(migration).toContain("review_outside_france")
    expect(migration).toContain("w039_geography_source_hash_not_approved")
    expect(migration).toContain("w039_geography_requires_one_activated_cutover_manifest")
    expect(migration).toContain("w039_geography_cutover_source_hash_mismatch")
    expect(migration).toContain("w039_geography_source_mapping_not_approved")
    expect(migration).toContain("'idempotent_replay',TRUE")
    expect(migration).not.toMatch(/SET\s+location\s*=/)
    expect(migration).toContain("repreneur_geography_targets")
    expect(migration).toContain("sync_repreneur_geography_targets_from_legacy")
    expect(migration).toContain("AFTER INSERT OR UPDATE OF q12_geo_zones, target_location")
    expect(migration).toContain("JSONB_ARRAY_LENGTH(NEW.q12_geo_zones) > 0")
    expect(migration).not.toContain("UPDATE public.repreneurs")
    expect(contract).toContain("migration 092 performs no big-bang backfill of current profiles")
    expect(profileSyncRehearsal).toContain("w039_rehearsal_existing_profile_was_backfilled")
    expect(profileSyncRehearsal).toContain("w039_rehearsal_future_profile_write_not_synchronized")
    expect(profileSyncRehearsal).toContain("w039_rehearsal_unknown_target_was_inferred")
    expect(contract).toContain("foreign, blank or non-resolving rows remain null")
  })

  it("allocates references atomically from historic exact numeric suffixes and makes them immutable", () => {
    expect(migration).toContain("opportunity_mandate_reference_counters")
    expect(migration).toContain("regexp_match(reference")
    expect(migration).toContain("initial_sequence + 1")
    expect(migration).toContain("CASE WHEN allocated < 1000")
    expect(migration).toContain("ON CONFLICT (reference_code) DO UPDATE")
    expect(migration).toContain("opportunity_reference_is_immutable")
    expect(migration).toContain("p_reference is retained only for old callers; it is deliberately ignored")
    expect(rehearsal).toContain("Re-New - IDF - 999")
    expect(rehearsal).toContain("Re-New - IDF - 1000")
    expect(rehearsal).toContain("w099_rehearsal_counter_initialization_failed")
    expect(rehearsal).toContain("w099_rehearsal_counter_serial_allocation_failed")
    expect(rehearsal).toContain("w099_rehearsal_failed_creation_consumed_a_number")
    expect(rehearsal).toContain("w099_rehearsal_reference_codes_not_independent")
    expect(rehearsal).toContain("w099_rehearsal_historical_reference_changed")
  })

  it("uses narrowly privileged services and locks month-only dates behind explicit confirmation", () => {
    expect(migration).toContain("SECURITY DEFINER SET search_path = ''")
    expect(migration).toContain("validate_w098_date_precision_write")
    expect(migration).toContain("SELECT date_added_precision INTO current_precision")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("opportunity_date_added_month_precision_requires_confirmation")
    expect(migration).toContain("IF confirm_day THEN")
    expect(migration).toContain("SET date_added_precision = 'day'")
    expect(migration).toContain("p_opportunity_fields - ARRAY['geography_node_id', 'date_added_confirm_day']")
    expect(migration).toContain("ALTER TABLE public.opportunity_mandate_reference_counters FORCE ROW LEVEL SECURITY")
    expect(migration).toContain("public.activate_w039_geography_mandates(TEXT) FROM PUBLIC, anon, authenticated")
    expect(rehearsal).toContain("w039_rehearsal_browser_privilege_exposed")
  })

  it("does not leak the staff-only geography bridge into repreneur deal projections", () => {
    const automaticProjection = repreneurPortal.match(
      /function toDealFlowOpportunity[\s\S]*?\n}\n\nfunction withoutRelevanceScore/,
    )?.[0]
    const publicProjection = repreneurPortal.match(
      /function withoutRelevanceScore[\s\S]*?\n}\n\nexport async function listMyRepreneurOpportunities/,
    )?.[0]

    expect(repreneurPortal).toContain("geography_node_id")
    expect(automaticProjection).toBeTruthy()
    expect(publicProjection).toBeTruthy()
    expect(automaticProjection).not.toContain("geography_node_id")
    expect(publicProjection).not.toContain("geography_node_id")
    expect(repreneurPortal).not.toMatch(/from\("opportunities"\)[\s\S]{0,240}\.select\(\s*["']\*["']/)
  })

  it("builds the one-time adoption payload from the hash-bound workbook and current literal-location digests", () => {
    expect(adoptionPreflight).toContain("Approved W-010 workbook hash mismatch")
    expect(adoptionPreflight).toContain("parsed.opportunities.length !== 148")
    expect(adoptionPreflight).toContain("sourceGeographyCode")
    expect(adoptionPreflight).toContain("locationDigest")
    expect(adoptionPreflight).toContain("Live W-010 reference set is not exactly 148 rows")
    expect(adoptionPreflight).toContain("BFC: \"fr-region-bourgogne-franche-comte\"")
    expect(adoptionPreflight).not.toContain("Unmapped W-010 geography code")
    expect(migration).toContain("source_geography_code TEXT,")
    expect(migration).toContain("source_code IS NOT NULL AND source_code !~")
    expect(migration).toContain("CREATE TEMP TABLE IF NOT EXISTS w039_rows")
    expect(migration).toContain("TRUNCATE TABLE w039_rows")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(adoptionRehearsal).toContain('await client.query("BEGIN")')
    expect(adoptionRehearsal).toContain('await client.query("ROLLBACK")')
    expect(adoptionRehearsal).toContain("Adoption rehearsal exact outcome mismatch")
    expect(adoptionRehearsal).toContain("expectedOutcomes")
    expect(adoptionRehearsal).toContain("Adoption rehearsal identical replay was not a no-op")
    expect(adoptionRehearsal).toContain("Adoption rehearsal replay duplicated evidence")
    expect(adoptionRehearsal).toContain("w039_geography_adoption_payload_mismatch")
    expect(localReplayRehearsal).toContain("w039_rehearsal_identical_retry_not_idempotent")
    expect(localReplayRehearsal).toContain("w039_rehearsal_identical_retry_duplicated_state")
    expect(localReplayRehearsal).toContain("w039_rehearsal_changed_payload_was_accepted")
    expect(adoptionRehearsal).toContain("Rollback changed opportunity geography")
  })
})
