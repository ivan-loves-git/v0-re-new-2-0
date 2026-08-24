import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260824093456_close_legacy_auth_and_data_api.sql"), "utf8")

describe("W-147 Supabase browser-role boundary", () => {
  it("revokes browser access by default and permits only explicit read exceptions", () => {
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY")
    expect(migration).not.toMatch(/GRANT SELECT ON TABLE public\.(?:clipboard|pdr_)/)
    expect(migration).toContain("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;")
    expect(migration).not.toMatch(/^GRANT\s+(?:ALL|INSERT|UPDATE|DELETE).*TO anon, authenticated;$/im)
  })
  it("removes generic browser policies and does not mutate Supabase identities", () => {
    expect(migration).toContain("FROM pg_policies")
    expect(migration).toContain("DROP POLICY IF EXISTS")
    expect(migration).toContain("'public'::name")
    expect(migration).not.toMatch(/auth\.users|DELETE\s+FROM\s+auth\./i)
  })
})
