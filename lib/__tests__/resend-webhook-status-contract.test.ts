import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migrationPath = `${process.cwd()}/scripts/103_email_log_complaint_status.sql`

describe("Resend webhook status contract", () => {
  it("persists every status emitted by the supported webhook event map", () => {
    const migration = readFileSync(migrationPath, "utf8")

    expect(migration).toContain("DROP CONSTRAINT email_logs_status_check")
    expect(migration).toContain(
      "'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained'",
    )
  })
})
