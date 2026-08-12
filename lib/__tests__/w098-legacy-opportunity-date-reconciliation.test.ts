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
    expect(migration).toContain("7f139050605e1c90dee92db79e7b8f6211a554b625365b024d260eea36627225")
    expect(migration).toContain("source_sheet TEXT NOT NULL")
    expect(migration).toContain("source_row INTEGER NOT NULL")
    expect(migration).toContain("source_reference TEXT NOT NULL")
    expect(migration).toContain("source_description_hash TEXT NOT NULL")
    expect(migration).toContain("live_description_hash TEXT NOT NULL")
    expect(migration).not.toContain("ma_cutover_runs")
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
    expect(migration).toContain("sync_opportunity_date_added_precision")
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF date_added ON public.opportunities")
    expect(migration).toContain("NEW.date_added_precision := 'day'")
    expect(migration).toContain("NEW.date_added_precision := NULL")
    expect(migration).toContain("actual_date = repair.prior_date_added AND actual_precision IS NULL")
    expect(migration).toContain("date_added_precision = 'month'")
    expect(migration).not.toContain("SET date_added_precision = 'month'\nWHERE date_added IS NOT NULL")
    expect(contract).toContain("W-098")
    expect(contract).toContain("precision-unknown")
  })

  it("rehearses the actual RPC definitions for preserve, confirm, clear, and new-day behavior", () => {
    const rehearsal = source("scripts/rehearse-w098-date-precision.sh")
    expect(rehearsal).toContain("Extract and execute the exact checked-in implementations")
    expect(rehearsal).toContain("w098_rehearsal_month_not_preserved")
    expect(rehearsal).toContain("w098_rehearsal_month_change_without_confirmation_accepted")
    expect(rehearsal).toContain("w098_rehearsal_confirmed_day_not_atomic")
    expect(rehearsal).toContain("w098_rehearsal_clear_not_atomic")
    expect(rehearsal).toContain("w098_rehearsal_new_staff_day_not_written")
    expect(rehearsal).toContain("W-098 date precision RPC rehearsal passed")
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
    expect(migration).toContain("existing_event.opportunity_reference <> repair.reference")
    expect(migration).toContain("existing_event.correction_code <> 'W-098 legacy month-year repair'")
    expect(migration).toContain("w098_unexpected_live_date_or_precision")
    expect(migration).toContain("w098_reconciliation_count_mismatch")
    expect(migration).toContain("A deliberate re-run is a verified no-op")
  })

  it("requires the canonical workbook parser before the repair can be approved", () => {
    const preflight = source("scripts/verify-w098-source-workbook.mjs")
    expect(preflight).toContain("verify-w098-legacy-source-workbook.py")
    const verifier = source("scripts/verify-w098-legacy-source-workbook.py")
    expect(verifier).toContain("7f139050605e1c90dee92db79e7b8f6211a554b625365b024d260eea36627225")
    expect(verifier).toContain('EXPECTED_SHEET = "2026.05.04 Source"')
    expect(verifier).toContain("EXPECTED_FORMAT_ID = 17")
    expect(verifier).toContain('"Re-New - AU - 001", 7, "Re-New - AU - 004", 45992, "2025-12-01"')
    expect(verifier).toContain('"Re-New - PL - 002", 92, "Re-New - PL - 002", 46054, "2026-02-01"')
    expect(preflight).toContain('if (cliArgs[0] === "--") cliArgs.shift()')
    expect(preflight).toContain("DIRECT_URL or DATABASE_URL is required")
    expect(preflight).toContain("six current live description fingerprints verified")
  })
})
