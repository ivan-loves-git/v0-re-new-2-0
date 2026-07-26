import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  `${process.cwd()}/scripts/077_retire_legacy_ma_mutations.sql`,
  "utf8",
)
const verification = readFileSync(
  `${process.cwd()}/scripts/verify-ma-data-model-schema.sql`,
  "utf8",
)

describe("legacy M&A write retirement", () => {
  it("keeps each legacy bridge readable while removing every service-role write grant", () => {
    for (const table of [
      "public.ma_sources",
      "public.ma_source_networks",
      "public.ma_source_contacts",
      "public.ma_source_contact_moves",
      "public.opportunity_source_contacts",
    ]) {
      expect(migration).toContain(table)
    }

    expect(migration).toMatch(
      /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).toMatch(
      /GRANT SELECT ON TABLE[\s\S]*TO service_role;/,
    )
    expect(migration).not.toContain("GRANT SELECT, INSERT")
    expect(migration).not.toContain("GRANT INSERT")
    expect(migration).not.toContain("GRANT UPDATE")
    expect(migration).not.toContain("GRANT DELETE")
  })

  it("retires the legacy contact-move function without dropping historical evidence", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.move_ma_source_contact(",
    )
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.move_ma_source_contact\([\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.move_ma_source_contact",
    )
    expect(migration).not.toContain("DROP TABLE")
    expect(migration).not.toContain("DELETE FROM")
  })

  it("keeps release verification evidence for inherited and direct privileges", () => {
    expect(verification).toContain("'legacy_role_capability'::text")
    expect(verification).toContain("'service_role_can_write'")
    expect(verification).toContain("'service_role_inherits_owner'")
    expect(verification).toContain("'move_ma_source_contact'")
  })
})
