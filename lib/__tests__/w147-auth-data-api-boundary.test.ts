import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260824093456_close_legacy_auth_and_data_api.sql"), "utf8")
const verifier = readFileSync(resolve(process.cwd(), "scripts/verify-w147-auth-data-api.sql"), "utf8")
const rehearsal = readFileSync(resolve(process.cwd(), "scripts/rehearse-w147-auth-data-api.sh"), "utf8")
const verifyWorkflow = readFileSync(resolve(process.cwd(), ".github/workflows/verify.yml"), "utf8")

describe("W-147 Supabase browser-role boundary", () => {
  it("revokes browser access by default and permits only explicit read exceptions", () => {
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;")
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;")
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;")
    expect(migration).toContain("ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("GRANT SELECT ON TABLE public.clipboard")
    expect(migration).toContain("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;")
    expect(migration).toContain("Hosted Supabase creates customer-owned application objects as postgres.")
    expect(migration).not.toMatch(/^GRANT\s+(?:ALL|INSERT|UPDATE|DELETE).*TO anon, authenticated;$/im)
  })
  it("removes generic browser policies and does not mutate Supabase identities", () => {
    expect(migration).toContain("FROM pg_policies")
    expect(migration).toContain("DROP POLICY IF EXISTS")
    expect(migration).toContain("'public'::name")
    expect(migration).not.toMatch(/auth\.users|DELETE\s+FROM\s+auth\./i)
  })
  it("gates the hosted owner invariant and proves future postgres objects remain private", () => {
    expect(verifier).toContain("w147_unexpected_public_table_owner")
    expect(verifier).toContain("w147_unexpected_public_sequence_owner")
    expect(verifier).toContain("w147_unexpected_public_function_owner")
    expect(rehearsal).toContain("SET ROLE postgres")
    expect(rehearsal).toContain("CREATE TABLE w147_future_table")
    expect(rehearsal).toContain("CREATE SEQUENCE w147_future_sequence")
    expect(rehearsal).toContain("CREATE FUNCTION public.w147_future_function")
    expect(verifyWorkflow).toContain("w147-w148-database-rehearsal:")
    expect(verifyWorkflow).toContain("image: postgres:17-alpine")
    expect(verifyWorkflow).toContain("CREATE TABLE w147_future_table")
    expect(verifyWorkflow).toContain("-f /tmp/w147-verify.sql")
    expect(verifyWorkflow).toContain("-f /tmp/scripts/rehearse-w148-private-cvs-storage.sql")
  })
})
