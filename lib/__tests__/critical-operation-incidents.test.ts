import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => database }))

import { scheduleCriticalOperationAlert } from "@/lib/observability/critical-operation-alert"

const failure = {
  operation: "email.resend_webhook" as const,
  error_category: "persistence_failed" as const,
  environment: "production" as const,
  release: "1234567",
}

function notification(kind: "opening" | "reminder" | "quiet" = "opening") {
  return {
    id: "52000000-0000-4000-8000-000000000001",
    lease_token: "52000000-0000-4000-8000-000000000002",
    idempotency_key: "wave-incident-52000000-0000-4000-8000-000000000001",
    kind,
    payload: {
      format_version: 1,
      ...failure,
      first_failure_at: "2026-10-10T06:00:00Z",
      last_failure_at: "2026-10-10T06:00:00Z",
      failure_count: 1,
      notice_at: "2026-10-10T06:00:00Z",
      from_email: "Re-New <noreply@example.test>",
      recipient: "operator@example.test",
    },
  }
}

async function deliver(send: ReturnType<typeof vi.fn>, release = failure.release) {
  const jobs: Array<() => Promise<void>> = []
  scheduleCriticalOperationAlert({ ...failure, release }, {
    now: new Date("2026-10-10T06:05:00Z"),
    recipient: "operator@example.test",
    send,
    schedule: (job) => jobs.push(job),
  })
  await jobs[0]()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "info").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("operational incident delivery", () => {
  it("sends nothing when the durable incident already has its notification", async () => {
    database.rpc.mockResolvedValue({ data: null, error: null })
    const send = vi.fn().mockResolvedValue({ data: { id: "provider-1" }, error: null })
    const jobs: Array<() => Promise<void>> = []
    scheduleCriticalOperationAlert(failure, {
      recipient: "operator@example.test",
      send,
      schedule: (job) => jobs.push(job),
    })
    await jobs[0]()
    expect(send).not.toHaveBeenCalled()
  })

  it("records provider acceptance against the exact claimed notification", async () => {
    const claim = notification()
    database.rpc.mockResolvedValueOnce({ data: claim, error: null })
      .mockResolvedValue({ data: true, error: null })
    const send = vi.fn().mockResolvedValue({ data: { id: "provider-1" }, error: null })
    await deliver(send)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "operator@example.test", subject: "[WAVE] Operational incident: email.resend_webhook",
      tags: [{ name: "renew_mail_class", value: "system" }],
    })
    expect(database.rpc).toHaveBeenCalledWith("critical_alert_complete", {
      p_notification_id: claim.id,
      p_lease_token: claim.lease_token,
      p_provider_id: "provider-1",
    })
  })

  it("keeps an uncertain provider attempt retryable with identical content across releases", async () => {
    const claim = notification()
    database.rpc.mockImplementation(async (name: string) => ({
      data: name === "critical_alert_observe" ? claim : true, error: null,
    }))
    const send = vi.fn().mockRejectedValueOnce(new Error("private provider response"))
      .mockResolvedValue({ data: { id: "provider-1" }, error: null })
    await deliver(send)
    expect(database.rpc).toHaveBeenCalledWith("critical_alert_release", {
      p_notification_id: claim.id, p_lease_token: claim.lease_token,
    })
    await deliver(send, "abcdef0")
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0])
    expect(send.mock.calls[1][0].cc).toBeUndefined()
    expect(send.mock.calls[1][0].bcc).toBeUndefined()
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private provider response")
  })

  it("uses one identical daily degraded-monitoring warning if the ledger is unavailable", async () => {
    database.rpc.mockResolvedValue({ data: null, error: { message: "private database error" } })
    const send = vi.fn().mockResolvedValue({ data: { id: "fallback-1" }, error: null })
    await deliver(send)
    await deliver(send, "abcdef0")
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1])
    expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: "wave-monitoring-degraded-production-2026-10-10" })
    expect(send.mock.calls[0][0].text).not.toContain("private database error")
    expect(send.mock.calls[0][0].text).not.toContain("1234567")
  })
  it("does not invent provider acceptance when the response has no receipt", async () => {
    const claim = notification()
    database.rpc.mockResolvedValueOnce({ data: claim, error: null }).mockResolvedValue({ data: true, error: null })
    const send = vi.fn().mockResolvedValue({ data: null, error: null })
    await deliver(send)
    expect(database.rpc.mock.calls.map(([name]) => name)).toEqual(["critical_alert_observe", "critical_alert_release"])
  })

  it("preserves the lease after provider acceptance cannot be recorded", async () => {
    database.rpc.mockResolvedValueOnce({ data: notification(), error: null })
      .mockResolvedValue({ data: null, error: { message: "private persistence error" } })
    const send = vi.fn().mockResolvedValue({ data: { id: "provider-1" }, error: null })
    await deliver(send)
    expect(send).toHaveBeenCalledOnce()
    expect(database.rpc.mock.calls.map(([name]) => name)).toEqual(["critical_alert_observe", "critical_alert_complete"])
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private persistence error")
  })

})
