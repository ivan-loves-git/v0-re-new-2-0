import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
const migration = source("scripts/097_external_pursuit_attachments.sql")
const rehearsal = source("scripts/rehearse-external-pursuit-attachments.sql")
const config = source("next.config.mjs")

describe("W-108 private attachment foundation", () => {
  it("sets matching 20 MiB application and private-bucket limits", () => {
    expect(config).toContain('bodySizeLimit: "22mb"')
    expect(migration).toContain("file_size_limit = EXCLUDED.file_size_limit")
    expect(migration).toContain("20971520")
    expect(migration).toContain("allowed_mime_types")
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*external-pursuit-attachments/i)
  })

  it("keeps the table server-read-only and every write behind narrow RPCs", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE public.external_pursuit_attachments FROM PUBLIC, anon, authenticated, service_role")
    expect(migration).toContain("GRANT SELECT ON TABLE public.external_pursuit_attachments TO service_role")
    expect(migration).toContain("public.assert_external_pursuit_access")
    expect(migration).toContain("p.deletion_status <> 'delete_requested'")
  })

  it("ships a disposable role, replay, privilege, bucket and safe-fulfillment rehearsal", () => {
    expect(rehearsal).toContain("097_external_pursuit_attachments.sql")
    expect(rehearsal).toContain("w108_other_owner_was_allowed")
    expect(rehearsal).toContain("w108_upload_replay_failed")
    expect(rehearsal).toContain("w108_legacy_fulfill_bypassed_attachments")
    expect(rehearsal).toContain("w108_bucket_controls_invalid")
    expect(rehearsal).toContain("ROLLBACK")
  })
})
