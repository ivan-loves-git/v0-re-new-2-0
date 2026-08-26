import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260826170000_w160_demo_repreneur_reporting.sql"), "utf8")

describe("W-160 DEMO repreneur classification contract", () => {
  it("uses an explicit default-false staff classification and a fixed 20-row manifest", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE")
    expect(migration).toContain("apply_w160_demo_repreneur_classification")
    expect(migration).toContain("rollback_w160_demo_repreneur_classification")
    expect((migration.match(/\('[0-9a-f-]{36}', '20/g) ?? []).length).toBe(20)
  })

  it("keeps ordinary callers out of the backfill boundary", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.apply_w160_demo_repreneur_classification(TEXT) FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.apply_w160_demo_repreneur_classification(TEXT) TO service_role")
  })
})
