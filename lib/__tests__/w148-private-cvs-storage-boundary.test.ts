import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-148 private CV/LDC storage boundary", () => {
  const migrationPath =
    "supabase/migrations/20260824093630_w148_private_cvs_storage_boundary.sql"

  it("matches the exact hosted policy-only migration recorded in production", () => {
    const migration = source(migrationPath)

    expect(Buffer.byteLength(migration)).toBe(2772)
    expect(createHash("sha256").update(migration).digest("hex")).toBe(
      "d71f05418da4a9b9afb741297a38ff8a7103bda8436df84696956d4a096af092",
    )
    expect(migration).toContain("WHERE id = 'cvs'\n      AND public = false")
    expect(migration).toContain("AND c.relrowsecurity")
    expect(migration).not.toMatch(/\bUPDATE\s+storage\.buckets\b/i)
    expect(migration).not.toMatch(/\bALTER\s+TABLE\s+storage\.objects\b/i)
    expect(migration).not.toMatch(/\b(?:GRANT|SET\s+ROLE|ALTER\s+ROLE)\b/i)
  })

  it("installs every restrictive guard before removing observed legacy CV policies", () => {
    const migration = source(migrationPath)
    const firstLegacyDrop = migration.indexOf(
      'DROP POLICY IF EXISTS "Anyone can view CVs"',
    )

    expect(firstLegacyDrop).toBeGreaterThan(-1)

    for (const policy of [
      "Allow authenticated deletes",
      "Allow authenticated updates",
      "Allow authenticated uploads",
      "Allow public read access",
      "Allow public reads",
      "Allow public uploads",
    ]) {
      expect(migration).toContain(
        `DROP POLICY IF EXISTS "${policy}" ON storage.objects;`,
      )
    }

    for (const operation of ["select", "insert", "update", "delete"]) {
      const guard = `CREATE POLICY "W-148 deny browser cvs ${operation}"`
      expect(migration.indexOf(guard)).toBeGreaterThan(-1)
      expect(migration.indexOf(guard)).toBeLessThan(firstLegacyDrop)
      expect(migration).not.toContain(
        `DROP POLICY IF EXISTS "W-148 deny browser cvs ${operation}"`,
      )
    }

    expect(migration).toContain("AS RESTRICTIVE")
    expect(migration).toContain("TO public")
    expect(migration).toContain("USING (bucket_id <> 'cvs')")
    expect(migration).toContain("WITH CHECK (bucket_id <> 'cvs')")
  })

  it("keeps the QA storage configuration aligned with the migration", () => {
    const configuration = source("supabase/schema/771_test_storage.sql")
    const rehearsal = source("scripts/rehearse-w148-private-cvs-storage.sql")

    for (const policy of [
      "W-148 deny browser cvs select",
      "W-148 deny browser cvs insert",
      "W-148 deny browser cvs update",
      "W-148 deny browser cvs delete",
    ]) {
      expect(configuration).toContain(`"${policy}"`)
    }

    expect(rehearsal).toContain("VALUES ('cvs', 'cvs', false)")
    expect(rehearsal).not.toContain("VALUES ('cvs', 'cvs', true)")
  })

  it("retains server-authorized, streamed CV/LDC delivery rather than a browser Storage redirect", () => {
    const route = source(
      "app/api/repreneurs/[id]/documents/[documentType]/route.ts",
    )

    expect(route).toContain("getCurrentUserAccess")
    expect(route).toContain("createSignedUrl")
    expect(route).toContain("proxyPrivateSignedStorageDownload")
    expect(route).not.toContain("NextResponse.redirect")
  })

  it("requires governed QA to prove upload, authorized streaming, denials, and cleanup", () => {
    const seed = source("scripts/qa/seed-phase-b-fixtures.mjs")
    const golden = source("tests/golden/golden-journeys.spec.ts")
    const cleanup = source("scripts/qa/cleanup-phase-b.mjs")

    expect(seed).toContain("ldc_url")
    expect(seed).toContain("manifest.storageObjects[0]")
    expect(golden).toContain('response.url().includes("/api/upload-cv")')
    expect(golden).toContain("staffDownload.status()).toBe(200)")
    expect(golden).toContain("ownLdc.status()).toBe(200)")
    expect(golden).toContain('.toBe("%PDF-")')
    expect(golden).toContain("/documents/cv`")
    expect(golden).toContain("/documents/ldc`")
    expect(golden).toContain(").toBe(403)")
    expect(cleanup).toContain('storage.storage.from("cvs").remove(objectNames)')
  })
})
