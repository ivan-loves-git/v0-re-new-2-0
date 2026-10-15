import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: boundary.rpc }) }))
vi.mock("resend", () => ({ Resend: class { emails = { send: boundary.send } } }))
vi.mock("@/lib/env", () => ({ env: {
  CRON_SECRET: "synthetic-cron-secret", WAVE_CRITICAL_ALERT_EMAIL: "operator@example.test",
  RESEND_API_KEY: "synthetic", RESEND_FROM_EMAIL: "noreply@example.test",
} }))

import { GET } from "@/app/api/cron/critical-operation-alerts/route"

const quietClaim = {
      id: "53000000-0000-4000-8000-000000000001", lease_token: "53000000-0000-4000-8000-000000000002",
      idempotency_key: "wave-incident-quiet-1", kind: "quiet",
      payload: { format_version: 1, environment: "production", operation: "email.resend_webhook", error_category: "persistence_failed",
        release: "1234567", first_failure_at: "2026-10-07T12:00:00Z", last_failure_at: "2026-10-08T06:00:00Z",
        failure_count: 300, notice_at: "2026-10-09T09:15:00Z", from_email: "Re-New <noreply@example.test>", recipient: "operator@example.test" },
    }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("VERCEL_ENV", "production")
  vi.stubEnv("QA_MAIL_MODE", "off")
  vi.spyOn(console, "info").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("daily operational incident check", () => {
  it("rejects unauthenticated requests before accessing incidents or sending", async () => {
    const response = await GET(new Request("http://localhost/api/cron/critical-operation-alerts"))
    expect(response.status).toBe(401)
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.send).not.toHaveBeenCalled()
  })

  it("sends the claimed quiet snapshot once without claiming that the defect was fixed", async () => {
    let claimed = false
    boundary.rpc.mockImplementation(async (name: string) => {
      if (name !== "critical_alert_claim_due") return { data: true, error: null }
      const data = claimed ? [] : [quietClaim]
      claimed = true
      return { data, error: null }
    })
    boundary.send.mockResolvedValue({ data: { id: "quiet-receipt" }, error: null })
    const response = await GET(new Request("http://localhost/api/cron/critical-operation-alerts", { headers: { authorization: "Bearer synthetic-cron-secret" } }))
    expect(response.status).toBe(200)
    expect(boundary.send).toHaveBeenCalledOnce()
    expect(boundary.send.mock.calls[0][0]).toMatchObject({ subject: "[WAVE] No further failures observed: email.resend_webhook" })
    expect(boundary.send.mock.calls[0][0].text).toContain("As of 2026-10-09T09:15:00Z")
    expect(boundary.send.mock.calls[0][0].text).toContain("does not prove")
    expect(boundary.rpc).toHaveBeenCalledWith("critical_alert_complete", expect.objectContaining({ p_provider_id: "quiet-receipt" }))
  })
  it("does not process production incidents in a preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    const response = await GET(new Request("http://localhost/api/cron/critical-operation-alerts", { headers: { authorization: "Bearer synthetic-cron-secret" } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ skipped: true })
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.send).not.toHaveBeenCalled()
  })

  it("reports an unavailable ledger using only the bounded fallback", async () => {
    boundary.rpc.mockResolvedValue({ data: null, error: { message: "private database failure" } })
    boundary.send.mockResolvedValue({ data: { id: "fallback-receipt" }, error: null })
    const response = await GET(new Request("http://localhost/api/cron/critical-operation-alerts", { headers: { authorization: "Bearer synthetic-cron-secret" } }))
    expect(response.status).toBe(503)
    expect(boundary.rpc).toHaveBeenCalledOnce()
    expect(boundary.send).toHaveBeenCalledOnce()
    expect(boundary.send.mock.calls[0][1].idempotencyKey).toMatch(/^wave-monitoring-degraded-production-\d{4}-\d{2}-\d{2}$/)
    expect(JSON.stringify(boundary.send.mock.calls)).not.toContain("private database failure")
  })

  it("leaves remaining notices unclaimed when a slow send uses the daily time budget", async () => {
    vi.useFakeTimers()
    try {
      boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "critical_alert_claim_due" ? [quietClaim] : true, error: null }))
      boundary.send.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 45_000)
        return { data: { id: "slow-receipt" }, error: null }
      })
      const response = await GET(new Request("http://localhost/api/cron/critical-operation-alerts", { headers: { authorization: "Bearer synthetic-cron-secret" } }))
      expect(await response.json()).toMatchObject({ sent: 1, failed: 0 })
      expect(boundary.rpc.mock.calls.filter(([name]) => name === "critical_alert_claim_due")).toEqual([
        ["critical_alert_claim_due", expect.objectContaining({ p_limit: 1 })],
      ])
      expect(boundary.send).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

})
