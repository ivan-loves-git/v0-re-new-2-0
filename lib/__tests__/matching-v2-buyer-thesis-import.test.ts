import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(resolve(process.cwd(), "scripts/20260823_matching_v2_buyer_thesis_import.sql"), "utf8")

describe("Matching v2 buyer-thesis import", () => {
  it("is bounded to the approved 19 source-backed eligible profiles", () => {
    expect(migration).toContain("matching_v2_source_profile_count_mismatch")
    expect(migration).toContain("matching_v2_pre_import_state_mismatch")
    expect(migration).toContain("matching_v2_eligible_client_count_mismatch")
    expect(migration).toContain("'david issautier', 'françois naimo'")
    expect(migration).not.toContain("François Corrignan', ARRAY")
    expect(migration).not.toContain("Pierre Fournis', ARRAY")
    expect(migration).not.toContain("Test2Colin Test2Hofman', ARRAY")
  })

  it("asserts stable identity, client lifecycle, and current accepted paid/end-to-end eligibility", () => {
    expect(migration).toContain("matching_v2_profile_identity_mismatch")
    expect(migration).toContain("matching_v2_profile_eligibility_mismatch")
    expect(migration).toContain("o.name IN ('Deal Flow - Paid', 'End-to-end support')")
    expect(migration).toContain("r.lifecycle_status = 'client'")
  })

  it("fails closed on numeric drift, writes exact open bounds, and reconciles all eligible geography", () => {
    expect(migration).toContain("matching_v2_numeric_profile_drift")
    expect(migration).toContain("matching_v2_nonnumeric_profile_drift")
    expect(migration).toContain("target_revenue_max_meur = p.revenue_max")
    expect(migration).toContain("target_ebitda_margin_max_pct = p.ebitda_margin_max")
    expect(migration).toContain("matching_v2_geography_bridge_reconciliation_mismatch")
    expect(migration).toContain("matching_v2_eligible_geography_bridge_missing")
    expect(migration).toContain("fr-region-hauts-de-france")
    expect(migration).toContain("fr-region-bourgogne-franche-comte")
    expect(migration).toContain("q12_geo_zones = TO_JSONB(p.geo_keys)")
    expect(migration).toContain("target_location = TO_JSONB(p.geo_keys)")
    expect(migration).toContain("sector_preferences = ARRAY(SELECT JSONB_ARRAY_ELEMENTS_TEXT(p.sectors))")
  })

  it("does not turn the tentative 0% EBITDA fallback into profile data", () => {
    const wassim = migration.match(/Wassim Sacre[^\n]*/)?.[0] ?? ""
    expect(wassim).toContain("2, 20, NULL, NULL, 15, NULL")
  })

  it("uses the approved automatic geographies and synchronizes the two book gaps", () => {
    const hypolite = migration.match(/Hypolite Hadrien[^\n]*/)?.[0] ?? ""
    const buaillon = migration.match(/Pierre-Alexis Buaillon[^\n]*/)?.[0] ?? ""
    const sacha = migration.match(/Sacha Picard[^\n]*/)?.[0] ?? ""
    expect(hypolite).toContain("1.5, 10, 10, NULL, 10, NULL")
    expect(buaillon).not.toContain("'all-france'")
    expect(sacha).toContain("'ile-de-france','hauts-de-france','grand-est','bourgogne-franche-comte','centre-val-de-loire','normandie'")
    expect(migration).toContain("'8a849298-4743-4e47-bbc5-0c554346879c', '5d9859d7-eb62-4bed-8ef9-d97a1b674364'")
  })

  it("normalizes Jean-Christophe's strict under-20 constraint to an integer maximum of 19", () => {
    const arvat = migration.match(/Jean-Christophe Arvat[^\n]*/)?.[0] ?? ""
    expect(migration).toContain("Source is strictly fewer than 20 employees; integer matching normalizes it to 19.")
    expect(arvat).toContain("2, 5, NULL, NULL, NULL, 19")
  })

  it("documents the required canonical stored-match refresh before UAT", () => {
    expect(migration).toContain("refresh-matching-v2-buyer-import.ts before UAT")
  })
})
