import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "svix"

const provider = vi.hoisted(() => ({
  send: vi.fn(),
  scheduled: [] as Array<() => Promise<void>>,
  receipt: null as null | { recipient_email: string; cc: string[] },
  rpc: vi.fn(),
  secret: "whsec_dGhpcy1pcy1vbmx5LWEtc3ludGhldGljLXNlY3JldA==",
}))

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: provider.send }
  },
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => provider.scheduled.push(task),
}))
vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "synthetic-provider-key",
    RESEND_FROM_EMAIL: "noreply@re-new.invalid",
    RESEND_WEBHOOK_SECRET: provider.secret,
    WAVE_CRITICAL_ALERT_EMAIL: "alerts@re-new.invalid",
  },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: provider.rpc,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: provider.receipt, error: null }),
      }
      return query
    },
  }),
}))

import { POST } from "@/app/api/webhooks/resend/route"
import { resend } from "@/lib/email/resend-client"
import { scheduleCriticalOperationAlert } from "@/lib/observability/critical-operation-alert"

function signedCallback(message: {
  from: string
  to: string | string[]
  subject: string
  tags: Array<{ name: string; value: string }>
}) {
  const date = new Date()
  const id = "evt-synthetic-alert"
  const payload = JSON.stringify({
    type: "email.delivered",
    created_at: date.toISOString(),
    data: {
      email_id: "synthetic-provider-message",
      from: message.from,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      tags: Object.fromEntries(message.tags.map(({ name, value }) => [name, value])),
    },
  })
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    body: payload,
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": new Webhook(provider.secret).sign(id, date, payload),
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("QA_MAIL_MODE", "off")
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("VERCEL_ENV", "production")
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "1234567")
  vi.spyOn(console, "info").mockImplementation(() => undefined)
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  provider.scheduled.length = 0
  provider.receipt = null
  provider.send.mockResolvedValue({ data: { id: "synthetic-provider-message" }, error: null })
  provider.rpc.mockImplementation(async (name: string, args: Record<string, string>) => ({ error: null, data: name === "critical_alert_observe" ? {
    id: "synthetic-notification", lease_token: "synthetic-lease", idempotency_key: "wave-critical:synthetic-notification", kind: "opening",
    payload: { format_version: 1, operation: args.p_operation, error_category: args.p_category,
      environment: args.p_environment, release: args.p_release, from_email: args.p_from, recipient: args.p_recipient,
      first_failure_at: "2026-10-10T06:00:00Z", last_failure_at: "2026-10-10T06:00:00Z",
      notice_at: "2026-10-10T06:00:00Z", failure_count: 1 },
  } : true }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("critical alerts through the shared sender and signed webhook", () => {
  it("acknowledges a delivered alert without retaining business facts or scheduling another alert", async () => {
    scheduleCriticalOperationAlert({
      operation: "email.resend_webhook",
      error_category: "persistence_failed",
      environment: "production",
      release: "1234567",
    })
    expect(provider.scheduled).toHaveLength(1)
    await provider.scheduled.shift()!()
    expect(provider.send).toHaveBeenCalledOnce()

    const message = provider.send.mock.calls[0][0]
    provider.rpc.mockClear()
    const response = await POST(signedCallback(message))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: "Unowned event acknowledged without retention",
    })
    expect(message.tags).toContainEqual({ name: "renew_mail_class", value: "system" })
    expect(message.cc).toBeUndefined()
    expect(message.bcc).toBeUndefined()
    expect(provider.rpc).not.toHaveBeenCalled()
    expect(provider.scheduled).toHaveLength(0)
    expect(provider.send).toHaveBeenCalledOnce()
  })

  it("still retries a business receipt race and retains its event after the parent exists", async () => {
    await resend.emails.send({
      from: "noreply@re-new.invalid",
      to: "primary@re-new.invalid",
      subject: "Synthetic operational message",
      text: "Synthetic business receipt fixture",
    })
    const message = provider.send.mock.calls[0][0]

    expect((await POST(signedCallback(message))).status).toBe(503)
    expect(provider.rpc).not.toHaveBeenCalled()

    provider.receipt = { recipient_email: "primary@re-new.invalid", cc: [] }
    expect((await POST(signedCallback(message))).status).toBe(200)
    expect(provider.rpc).toHaveBeenCalledOnce()
    expect(provider.rpc).toHaveBeenCalledWith(
      "email_provider_record_event",
      expect.objectContaining({
        p_id: "evt-synthetic-alert",
        p_provider_id: "synthetic-provider-message",
        p_type: "email.delivered",
        p_recipient_kind: "primary",
        p_recipient: "primary@re-new.invalid",
      }),
    )
  })
})
