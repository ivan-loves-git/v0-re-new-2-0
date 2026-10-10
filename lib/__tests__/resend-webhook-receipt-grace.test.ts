import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "svix"

const m = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  trace: {
    success: vi.fn(),
    failure: vi.fn(),
  },
  fetchResult: {
    data: undefined as undefined | { recipient_email: string; cc: string[] },
    error: null as unknown,
  },
  rpc: vi.fn(),
  secret: "whsec_dGhpcy1pcy1vbmx5LWEtc3ludGhldGljLXNlY3JldA==",
}))

vi.mock("@/lib/env", () => ({ env: { RESEND_WEBHOOK_SECRET: m.secret } }))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: () => m.trace,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: m.createAdminClient,
}))

import { POST } from "@/app/api/webhooks/resend/route"

function installDatabaseBoundary() {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => m.fetchResult,
  }
  m.createAdminClient.mockReturnValue({
    from: () => query,
    rpc: m.rpc,
  })
}

function signedBusinessCallback(createdAt: string, valid = true) {
  const sentAt = new Date()
  const id = "evt-receipt-grace"
  const payload = JSON.stringify({
    type: "email.delivered",
    created_at: createdAt,
    data: {
      email_id: "provider-receipt-grace",
      from: "sender@re-new.invalid",
      to: ["primary@re-new.invalid"],
      subject: "private subject must not reach diagnostics",
      tags: { renew_mail_class: "business" },
    },
  })

  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(sentAt.getTime() / 1000)),
      "svix-signature": valid
        ? new Webhook(m.secret).sign(id, sentAt, payload)
        : "v1,forged",
    },
    body: payload,
  })
}

describe("signed Resend receipt grace", () => {
  const now = new Date("2026-10-10T09:00:00.000Z")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()
    m.fetchResult = { data: undefined, error: null }
    m.rpc.mockResolvedValue({ error: null })
    installDatabaseBoundary()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("requests a retry for a newly created missing business receipt without an alertable failure", async () => {
    const response = await POST(signedBusinessCallback(now.toISOString()))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: "Business receipt not yet available; retry event",
    })
    expect(m.trace.failure).toHaveBeenCalledWith("provider_pending")
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("treats a missing business receipt older than five minutes as persistence failure", async () => {
    const response = await POST(
      signedBusinessCallback(new Date(now.getTime() - 5 * 60_000 - 1).toISOString()),
    )

    expect(response.status).toBe(503)
    expect(m.trace.failure).toHaveBeenCalledWith("persistence_failed")
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("does not grant the pending grace to a pathological future timestamp", async () => {
    const response = await POST(
      signedBusinessCallback(new Date(now.getTime() + 10 * 60_000).toISOString()),
    )

    expect(response.status).toBe(503)
    expect(m.trace.failure).toHaveBeenCalledWith("persistence_failed")
  })

  it("keeps database correlation failures alertable immediately", async () => {
    m.fetchResult = { data: undefined, error: { code: "PGRST001", message: "private detail" } }

    const response = await POST(signedBusinessCallback(now.toISOString()))

    expect(response.status).toBe(500)
    expect(m.trace.failure).toHaveBeenCalledWith("persistence_failed")
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("keeps event-write failures alertable immediately after a receipt is found", async () => {
    m.fetchResult = {
      data: { recipient_email: "primary@re-new.invalid", cc: [] },
      error: null,
    }
    m.rpc.mockResolvedValue({ error: { code: "P0001", message: "private detail" } })

    const response = await POST(signedBusinessCallback(now.toISOString()))

    expect(response.status).toBe(500)
    expect(m.trace.failure).toHaveBeenCalledWith("persistence_failed")
  })

  it("retains the callback once the parent receipt has committed", async () => {
    m.fetchResult = {
      data: { recipient_email: "primary@re-new.invalid", cc: [] },
      error: null,
    }

    const response = await POST(signedBusinessCallback(now.toISOString()))

    expect(response.status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith(
      "email_provider_record_event",
      expect.objectContaining({
        p_id: "evt-receipt-grace",
        p_provider_id: "provider-receipt-grace",
        p_recipient_kind: "primary",
      }),
    )
    expect(m.trace.success).toHaveBeenCalledOnce()
  })

  it("does not access persistence for an invalid signature", async () => {
    const response = await POST(signedBusinessCallback(now.toISOString(), false))

    expect(response.status).toBe(401)
    expect(m.createAdminClient).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
