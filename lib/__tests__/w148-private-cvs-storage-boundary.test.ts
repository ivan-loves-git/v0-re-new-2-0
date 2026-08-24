import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-148 private CV/LDC storage boundary", () => {
  const migrationPath =
    "supabase/migrations/20260824093630_w148_private_cvs_storage_boundary.sql"

  it("makes the bucket private and removes every observed legacy CV policy", () => {
    const migration = source(migrationPath)

    expect(migration).toContain("SET public = false")
    expect(migration).toContain("WHERE id = 'cvs';")
    expect(migration).toContain("ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;")

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
  })

  it("contains restrictive browser-role denials for every object operation", () => {
    const migration = source(migrationPath)

    for (const operation of ["select", "insert", "update", "delete"]) {
      expect(migration).toContain(
        `CREATE POLICY "W-148 deny browser cvs ${operation}"`,
      )
    }

    expect(migration).toContain("AS RESTRICTIVE")
    expect(migration).toContain("TO public")
    expect(migration).toContain("USING (bucket_id <> 'cvs')")
    expect(migration).toContain("WITH CHECK (bucket_id <> 'cvs')")
  })

  it("keeps the QA storage configuration aligned with the migration", () => {
    const configuration = source("supabase/schema/771_test_storage.sql")

    for (const policy of [
      "W-148 deny browser cvs select",
      "W-148 deny browser cvs insert",
      "W-148 deny browser cvs update",
      "W-148 deny browser cvs delete",
    ]) {
      expect(configuration).toContain(`"${policy}"`)
    }
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
})
