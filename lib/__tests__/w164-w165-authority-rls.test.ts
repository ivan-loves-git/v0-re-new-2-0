import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-164/W-165 authority-table RLS", () => {
  it("keeps every new public authority and audit table behind RLS", () => {
    const hardening = source(
      "supabase/migrations/20260827120722_w164_w165_authority_table_rls.sql",
    )

    for (const table of [
      "w164_visibility_reconciliation_runs",
      "w164_visibility_reconciliation_rollbacks",
      "private_upload_intents",
      "private_upload_cleanup_queue",
      "private_intake_upload_claims",
    ]) {
      expect(hardening).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      )
    }
  })

  it("retains service-role-only table grants in the owning migrations", () => {
    const visibility = source(
      "supabase/migrations/20260827103000_w164_lifecycle_namespace_visibility.sql",
    )
    const uploads = source(
      "supabase/migrations/20260827113000_w165_private_direct_uploads.sql",
    )

    expect(visibility).toContain(
      "FROM PUBLIC,anon,authenticated,service_role;",
    )
    expect(visibility).toContain("TO service_role;")
    expect(uploads).toContain(
      "FROM PUBLIC,anon,authenticated,service_role;",
    )
    expect(uploads).toContain("TO service_role;")
  })
})
