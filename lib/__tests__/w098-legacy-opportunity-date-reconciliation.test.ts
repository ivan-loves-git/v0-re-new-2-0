import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migrationPath = "scripts/091_w098_legacy_opportunity_date_reconciliation.sql"
const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

function source(relativePath: string) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
}

describe("W-098 legacy opportunity date reconciliation", () => {
  const migration = source(migrationPath)
  const contract = source(contractPath)

  it("repairs exactly the six source-backed legacy rows and no importer path", () => {
    const expectedMappings = [
      ["733e7e38-784a-4dbb-9815-f399a5fcab16", "2001-12-25", "2025-12-01"],
      ["de8a550c-a77b-4a80-9c06-800aac8e109f", "2001-01-26", "2026-01-01"],
      ["104edeab-0383-4e9a-9b40-b27385b41795", "2001-01-26", "2026-01-01"],
      ["2650915e-f648-47ea-a4f8-b30abc47bcef", "2001-01-26", "2026-01-01"],
      ["ab4847d8-09dd-4a54-ad6a-967a28bdaa4e", "2001-05-26", "2026-05-01"],
      ["1d0fc197-e26d-4274-9a74-04c6719c600e", "2001-02-26", "2026-02-01"],
    ]

    expect(migration).toContain("W-098 — narrow, source-backed repair")
    expect(migration).toContain("a4b50611de0578a4a2b36f8c6da284c6e53d10b2fd4f418ab560dd31a9a0d6a5")
    expect(migration).toContain("FROM public.ma_cutover_runs run")
    expect(migration).toContain("run.status = 'activated'")
    expect(migration).toContain("w098_canonical_cutover_manifest_missing_or_not_activated")
    expect(migration).not.toContain("run-w010-cutover")
    expect(migration).not.toContain("COPY public.opportunities")

    for (const [id, priorDate, correctedDate] of expectedMappings) {
      expect(migration).toContain(id)
      expect(migration).toContain(`DATE '${priorDate}'`)
      expect(migration).toContain(`DATE '${correctedDate}'`)
    }
  })

  it("adds bounded precision without inventing it for other legacy dates", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS date_added_precision TEXT")
    expect(migration).toContain("date_added_precision IS NULL OR date_added_precision IN ('day', 'month')")
    expect(migration).toContain("actual_date = repair.prior_date_added AND actual_precision IS NULL")
    expect(migration).toContain("date_added_precision = 'month'")
    expect(migration).not.toContain("SET date_added_precision = 'month'\nWHERE date_added IS NOT NULL")
    expect(contract).toContain("W-098")
    expect(contract).toContain("precision-unknown")
  })

  it("is transactional, lock-guarded, auditable, and idempotent", () => {
    expect(migration).toContain("BEGIN;")
    expect(migration).toContain("COMMIT;")
    expect(migration).toContain("FOR UPDATE;")
    expect(migration).toContain("ma_opportunity_date_correction_events")
    expect(migration).toContain("UNIQUE REFERENCES public.opportunities(id)")
    expect(migration).toContain("ma_opportunity_date_correction_events_are_immutable")
    expect(migration).toContain("FORCE ROW LEVEL SECURITY")
    expect(migration).toContain("w098_existing_repair_evidence_mismatch")
    expect(migration).toContain("w098_unexpected_live_date_or_precision")
    expect(migration).toContain("w098_reconciliation_count_mismatch")
    expect(migration).toContain("A deliberate re-run is a verified no-op")
  })
})
