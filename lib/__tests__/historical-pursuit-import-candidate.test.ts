import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("scripts/112_historical_pursuit_ledger.sql", "utf8")
const runner = readFileSync("scripts/run-historical-pursuit-import.mjs", "utf8")
const staffProjection = readFileSync("lib/data/historical-pursuit-import.ts", "utf8")

describe("W-112 historical pursuit import candidate", () => {
  it("uses a staff-only source-row ledger and exact idempotency key", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.historical_pursuit_import_rows")
    expect(migration).toContain("UNIQUE (source_sha256, source_sheet, source_row)")
    expect(migration).toContain("FORCE ROW LEVEL SECURITY")
    expect(migration).toContain("historical_pursuit_import_rows_are_immutable")
    expect(migration).toContain("source_cells JSONB NOT NULL")
    expect(migration).toContain("manifest_digest TEXT NOT NULL")
    expect(migration).toContain("historical_pursuit_source_row_payload_mismatch")
    expect(migration).toContain("pg_advisory_xact_lock")
  })

  it("keeps historic open rows as drafts, preserves current state, and preserves the confidential journey boundary", () => {
    expect(migration).toContain("v_match.status = 'draft' AND v_terminal")
    expect(migration).toContain("current_status_preserved")
    expect(migration).toContain("CASE WHEN v_terminal THEN 'dropped'")
    expect(migration).toContain("pursuit_stage IS NULL")
    expect(migration).not.toContain("'dropped'::public.opportunity_pursuit_stage")
    expect(migration).not.toContain("opportunity_pursuit_evidence")
    expect(migration).not.toContain("opportunity_pursuit_events")
    expect(migration).not.toContain("opportunity_nda_artifacts")
    expect(migration).not.toContain("opportunity_pursuit_confidential_grants")
    expect(migration).not.toContain("opportunity_documents")
    expect(migration).not.toContain("journey_")
    expect(migration).not.toContain("UPDATE public.opportunities")
  })

  it("has a rollback-only rehearsal mode and transaction rollback on failure", () => {
    expect(runner).toContain('await client.query("BEGIN")')
    expect(runner).toContain('if (config.mode === "rehearse") await client.query("ROLLBACK")')
    expect(runner).toContain('try { await client.query("ROLLBACK"); }')
    expect(runner).toContain("apply_historical_pursuit_import_row")
    expect(runner).toContain("112_historical_pursuit_ledger.sql")
    expect(runner).toContain("Historical pursuit replay changed a source row")
  })

  it("exposes retained history through a server-only staff projection only", () => {
    expect(staffProjection).toContain('import "server-only"')
    expect(staffProjection).toContain("requireStaffAccess()")
    expect(staffProjection).toContain("historical_pursuit_import_rows")
  })
})
