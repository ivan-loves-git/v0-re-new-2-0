import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(join(process.cwd(), "scripts/108_notification_delivery_claims.sql"), "utf8")

describe("notification delivery claim migration", () => {
  it("serializes claims, fences stale completion, and keeps sent terminal", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.notification_delivery_claims")
    expect(sql).toContain("pg_advisory_xact_lock")
    expect(sql).toContain("lease_expires_at")
    expect(sql).toContain("lease_token")
    expect(sql).toContain("existing.lease_token::TEXT IS DISTINCT FROM normalized_lease_token")
    expect(sql).toContain("ELSE 'failed'")
    expect(sql).toContain("status = 'sent'")
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.claim_notification_delivery")
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.complete_notification_delivery")
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.claim_notification_delivery")
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.claim_notification_delivery")
    expect(sql).toContain("TO service_role")
  })

  it("gives idempotent email logs and their daily count one durable finalization", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS idempotency_key TEXT")
    expect(sql).toContain("idx_email_logs_idempotency_key")
    expect(sql).toContain("DROP INDEX IF EXISTS public.idx_email_logs_idempotency_key")
    expect(sql).toContain("ON public.email_logs (idempotency_key);")
    expect(sql).toContain("daily_counted_at")
    expect(sql).toContain("provider_attempted_at")
    expect(sql).toContain("provider_outcome")
    expect(sql).toContain("'attempting', 'uncertain', 'rejected', 'accepted'")
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.finalize_idempotent_email_delivery")
    expect(sql).toContain("FOR UPDATE")
    expect(sql).toContain("email_daily_counts")
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.claim_cron_reminder_delivery")
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.complete_cron_reminder_delivery")
  })
})
