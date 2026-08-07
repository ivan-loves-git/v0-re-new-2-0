import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const migration = readFileSync(
  `${root}/scripts/086_opportunity_intake_reliability_and_existing_offices.sql`,
  "utf8",
)
const rehearsal = readFileSync(
  `${root}/scripts/rehearse-opportunity-intake-reliability.sql`,
  "utf8",
)

describe("W-082/W-088 opportunity-intake reliability migration", () => {
  it("fails preflight explicitly before adding the active real-office duplicate backstop", () => {
    expect(migration).toContain(
      "migration_086_duplicate_active_real_office_names",
    )
    expect(migration).toContain("idx_ma_offices_active_real_name_per_firm")
    expect(migration).toContain("WHERE status = 'active' AND NOT is_default")
  })

  it("keeps real-office creation staff-service-only, serialized and audited", () => {
    expect(migration).toContain("create_ma_office_for_existing_firm")
    expect(migration).toContain("ma_existing_firm_not_active")
    expect(migration).toContain("ma_real_office_name_already_exists")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("REVOKE ALL ON FUNCTION")
    expect(migration).toContain("TO service_role")
    expect(migration).not.toContain("INSERT INTO public.ma_sources")
  })

  it("rehearses success, normalized duplicates and archived-firm denial without persisting fixtures", () => {
    expect(rehearsal).toContain("rehearsal_086_office_not_created")
    expect(rehearsal).toContain("ma_real_office_name_already_exists")
    expect(rehearsal).toContain("ma_existing_firm_not_active")
    expect(rehearsal).toContain("ROLLBACK")
  })
})
