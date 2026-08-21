import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = () =>
  readFileSync(`${process.cwd()}/scripts/qa/reconstruct-preview-schema.mjs`, "utf8")
const cleanupSource = () =>
  readFileSync(`${process.cwd()}/supabase/schema/771_preview_cleanup.sql`, "utf8")

describe("fresh preview schema reconstruction command", () => {
  it("fails closed on production and cross-variable branch mismatches", () => {
    const script = source()
    expect(script).toContain("iiuqcdnmxhtyispnykgf")
    expect(script).toContain("QA_SUPABASE_PROJECT_REF")
    expect(script).toContain("production-ref")
    expect(script).toContain("database-ref")
    expect(script).toContain("pooler\\.supabase\\.com")
    expect(script).toContain("postgresql?:")
    expect(script).toContain("QA_BRANCH_EVIDENCE_FILE")
    expect(script).toContain("validateBranchReconstructionEvidence")
  })

  it("requires an empty public application schema before applying the baseline", () => {
    const cleanup = cleanupSource()
    expect(cleanup).toContain("pdr_work_card_reference_seq")
    expect(cleanup).toContain("pg_proc")
    expect(cleanup).toContain("pg_type")
    expect(cleanup).toContain("schema-not-empty")
  })

  it("applies extensions, sanctioned public DDL, and test-safe storage in order", () => {
    const script = source()
    const cleanup = script.indexOf("771_preview_cleanup.sql")
    const extensions = script.indexOf("771_extensions.sql")
    const publicSchema = script.indexOf("771_public_schema.sql")
    const storage = script.indexOf("771_test_storage.sql")
    expect(cleanup).toBeGreaterThanOrEqual(0)
    expect(extensions).toBeGreaterThan(cleanup)
    expect(publicSchema).toBeGreaterThan(extensions)
    expect(storage).toBeGreaterThan(publicSchema)
    expect(script).toContain("ON_ERROR_STOP=1")
    expect(script).toContain("--single-transaction")
  })

  it("passes the database password only through process environment", () => {
    const script = source()
    expect(script).toContain("PGPASSWORD")
    expect(script).toContain('PGSSLMODE: "verify-full"')
    expect(script).toContain("QA_DATABASE_CA_CERT_FILE")
    expect(script).toContain("PGSSLROOTCERT: databaseCaCertFile")
    expect(script).not.toMatch(/--password(?:=|\s)/)
    expect(script).not.toContain("connection.href")
  })
})
