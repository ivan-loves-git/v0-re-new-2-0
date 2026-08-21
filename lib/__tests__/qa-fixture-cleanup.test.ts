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
    expect(script).toContain('DELETE FROM public."user" WHERE id = $1')
    expect(script).toContain(".remove([storageFixture.path])")
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
