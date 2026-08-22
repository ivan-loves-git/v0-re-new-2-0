import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = () =>
  readFileSync(`${process.cwd()}/scripts/qa/rehearse-fixture-cleanup.mjs`, "utf8")

describe("exact QA fixture cleanup rehearsal", () => {
  it("requires the isolation preflight before any fixture mutation", () => {
    const script = source()
    expect(script).toContain("validateIsolationPreflight")
    expect(script.indexOf("validateIsolationPreflight")).toBeLessThan(
      script.indexOf("INSERT INTO public.\"user\""),
    )
  })

  it("uses manifest-owned exact IDs and paths for creation and cleanup", () => {
    const script = source()
    expect(script).toContain("manifest.databaseRows")
    expect(script).toContain("manifest.storageObjects")
    expect(script).toContain("DELETE FROM public.repreneurs WHERE id = $1")
    expect(script).toContain("DELETE FROM public.app_user_roles WHERE id = $1")
    expect(script).toContain('DELETE FROM public."user" WHERE id = $1')
    expect(script).toContain(".remove([storageFixture.path])")
  })

  it("fails closed before connecting and deletes Phase B outputs only by recorded IDs", () => {
    const script = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    const common = readFileSync(`${process.cwd()}/scripts/qa/phase-b-common.mjs`, "utf8")
    expect(common.indexOf("assertSafeQaRuntime(process.env)")).toBeLessThan(common.indexOf("client.connect()"))
    expect(script).toContain("recordRuntimeFixtures")
    expect(script).toContain("DELETE FROM public.repreneurs WHERE id = ANY")
    expect(script).toContain("DELETE FROM public.opportunities WHERE id = ANY")
    expect(script).not.toContain("DELETE FROM public.repreneurs WHERE lower(email)")
    expect(script).not.toContain("reference_code='QA'")
  })

  it("collects every exact run-scoped P3 retry and remains idempotent after deletion", () => {
    const script = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    expect(script).toContain("public_title=$1 AND created_by=$2")
    expect(script).toContain("scopedOpportunities.rows.length > 2")
    expect(script).toContain("WHERE opportunity_id = ANY($1::uuid[])")
    expect(script).not.toContain("opportunity-ledger-mismatch")
    expect(script).not.toContain("match-ledger-mismatch")
  })

  it("removes exact QA evidence without weakening append-only protection after cleanup", () => {
    const script = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    const begin = script.indexOf('database.query("BEGIN")')
    const disable = script.indexOf("DISABLE TRIGGER opportunity_pursuit_evidence_immutable")
    const removeEvidence = script.indexOf("DELETE FROM public.opportunity_pursuit_evidence WHERE id = ANY")
    const enable = script.indexOf("ENABLE TRIGGER opportunity_pursuit_evidence_immutable")
    const commit = script.indexOf('database.query("COMMIT")')

    expect(disable).toBeGreaterThan(begin)
    expect(removeEvidence).toBeGreaterThan(disable)
    expect(enable).toBeGreaterThan(removeEvidence)
    expect(commit).toBeGreaterThan(enable)
  })

  it("reports only a sanitized database error class when cleanup fails", () => {
    const script = readFileSync(`${process.cwd()}/scripts/qa/cleanup-phase-b.mjs`, "utf8")
    expect(script).toContain("safeDatabaseToken")
    expect(script).toContain("Phase B cleanup failed: database-${safeDatabaseToken(error)}")
  })

  it("verifies zero residue after cleanup", () => {
    const script = source()
    expect(script).toContain("databaseResidue")
    expect(script).toContain("storageResidue")
    expect(script).toContain("fixture-cleanup-residue")
  })

  it("never mutates Supabase Auth users", () => {
    const script = source()
    expect(script).not.toContain("auth.admin.createUser")
    expect(script).not.toContain("auth.users")
  })

  it("keeps TLS certificate verification enabled for direct database access", () => {
    const script = source()
    expect(script).toContain("rejectUnauthorized: true")
    expect(script).toContain("QA_DATABASE_CA_CERT_FILE")
    expect(script).toContain("ca: databaseCa")
    expect(script).not.toContain("rejectUnauthorized: false")
  })
})
