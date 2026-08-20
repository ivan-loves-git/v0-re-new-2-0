import { Webhook } from "svix"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
  wasEmailSent: vi.fn(),
  getTemplateSubject: vi.fn(),
  getTemplateBody: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/email", () => ({
  sendEmail: mocks.sendEmail,
  wasEmailSent: mocks.wasEmailSent,
}))
vi.mock("@/lib/actions/emails", () => ({
  getTemplateSubject: mocks.getTemplateSubject,
  getTemplateBody: mocks.getTemplateBody,
}))
vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "test-cron-secret",
    RESEND_WEBHOOK_SECRET: `whsec_${Buffer.from("test-webhook-secret").toString("base64")}`,
    CC_ON_INTERVIEW_REMINDER: "staff@test.invalid",
  },
}))

import { GET as runDailyCron } from "@/app/api/cron/abandoned-forms/route"
import { POST as receiveResendWebhook } from "@/app/api/webhooks/resend/route"

function emittedEvents() {
  return [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]
    .map(([entry]) => JSON.parse(String(entry))) as Array<
    Record<string, unknown>
  >
}

function chain(result: { data: unknown; error: unknown }) {
  const query = new Proxy<Record<string, unknown>>(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (
            resolve: (value: typeof result) => unknown,
            reject: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject)
        }
        return vi.fn(() => query)
      },
    },
  )
  return query
}

function webhookRequest(payload: Record<string, unknown>, valid = true) {
  const body = JSON.stringify(payload)
  const timestamp = new Date()
  const signature = valid
    ? new Webhook(
        `whsec_${Buffer.from("test-webhook-secret").toString("base64")}`,
      ).sign("msg_test_webhook", timestamp, body)
    : "v1,invalid"
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers: {
      "svix-id": "msg_test_webhook",
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
    },
    body,
  })
}

const webhookPayload = {
  type: "email.delivered",
  created_at: "2026-08-18T12:00:00.000Z",
  data: {
    email_id: "provider-private-123",
    from: "sender@example.test",
    to: ["recipient@example.test"],
    subject: "Private opportunity subject",
    created_at: "2026-08-18T12:00:00.000Z",
  },
}

describe("critical route traces", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  it("traces an accepted Resend webhook without copying provider payload data", async () => {
    const fetchSingle = vi.fn().mockResolvedValue({
      data: { id: "email-log-1", status: "sent" },
      error: null,
    })
    const fetchEq = vi.fn(() => ({ single: fetchSingle }))
    const select = vi.fn(() => ({ eq: fetchEq }))
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select, update })),
    })

    const response = await receiveResendWebhook(webhookRequest(webhookPayload))

    expect(response.status).toBe(200)
    expect(emittedEvents().map((event) => event.stage)).toEqual([
      "start",
      "success",
    ])
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    for (const privateValue of [
      "provider-private-123",
      "sender@example.test",
      "recipient@example.test",
      "Private opportunity subject",
      "email-log-1",
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it("keeps an invalid webhook response unchanged and records only a safe category", async () => {
    const response = await receiveResendWebhook(
      webhookRequest(webhookPayload, false),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Invalid signature" })
    expect(emittedEvents()[1]).toMatchObject({
      operation: "email.resend_webhook",
      stage: "failure",
      error_category: "signature_invalid",
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("records an empty authorized cron run using only fixed operation names", async () => {
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => chain({ data: [], error: null })),
    })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message:
        "abandoned: 0; interview reminders: 0; booking reminders: 0; stale leads shifted: 0",
      sent: 0,
      interviewSent: 0,
      bookingSent: 0,
      staleShifted: 0,
    })
    const operations = emittedEvents()
      .filter((event) => event.stage === "success")
      .map((event) => event.operation)
    expect(operations).toEqual([
      "cron.abandoned_reminders",
      "cron.interview_reminders",
      "cron.booking_reminders",
      "cron.stale_leads",
      "cron.abandoned_forms",
    ])
  })

  it("keeps a cron database failure generic in both HTTP and runtime logs", async () => {
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() =>
        chain({
          data: null,
          error: new Error(
            "database exploded for recipient@example.test opportunity-private-1",
          ),
        }),
      ),
    })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Cron job failed" })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("database exploded")
    expect(serialized).not.toContain("recipient@example.test")
    expect(serialized).not.toContain("opportunity-private-1")
    expect(emittedEvents().slice(-2)).toEqual([
      expect.objectContaining({
        operation: "cron.abandoned_reminders",
        stage: "failure",
        error_category: "persistence_failed",
      }),
      expect.objectContaining({
        operation: "cron.abandoned_forms",
        stage: "failure",
        error_category: "persistence_failed",
      }),
    ])
  })

  it("marks a reminder subjob failed when the email helper returns a failure result", async () => {
    const abandonedForm = {
      id: "abandonment-private-1",
      last_activity_at: "2026-08-16T12:00:00.000Z",
      last_step_completed: 2,
      reminder_count: 0,
      repreneurs: {
        id: "repreneur-private-1",
        first_name: "Private",
        last_name: "Person",
        email: "recipient@example.test",
        marketing_consent: true,
      },
    }
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        chain({
          data: table === "intake_abandonment_tracking" ? [abandonedForm] : [],
          error: null,
        }),
      ),
    })
    mocks.wasEmailSent.mockResolvedValue(false)
    mocks.getTemplateSubject.mockResolvedValue("Private reminder subject")
    mocks.sendEmail.mockResolvedValue({
      success: false,
      error: "provider rejected recipient@example.test",
    })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message:
        "abandoned: 1; interview reminders: 0; booking reminders: 0; stale leads shifted: 0",
      sent: 1,
      interviewSent: 0,
      bookingSent: 0,
      staleShifted: 0,
    })
    expect(
      emittedEvents().find(
        (event) =>
          event.operation === "cron.abandoned_reminders" &&
          event.stage === "failure",
      ),
    ).toMatchObject({ error_category: "provider_unavailable" })
    expect(
      emittedEvents().find(
        (event) =>
          event.operation === "cron.abandoned_forms" &&
          event.stage === "failure",
      ),
    ).toMatchObject({ error_category: "internal_error" })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("recipient@example.test")
    expect(serialized).not.toContain("provider rejected")
  })

  it("closes the active cron subjob trace when a dependency rejects", async () => {
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() =>
        chain({
          data: [
            {
              id: "abandonment-private-1",
              last_activity_at: "2026-08-16T12:00:00.000Z",
              last_step_completed: 2,
              reminder_count: 0,
              repreneurs: {
                id: "repreneur-private-1",
                first_name: "Private",
                last_name: "Person",
                email: "recipient@example.test",
                marketing_consent: true,
              },
            },
          ],
          error: null,
        }),
      ),
    })
    mocks.wasEmailSent.mockRejectedValue(
      new Error("dedupe failed for recipient@example.test"),
    )

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(500)
    const abandonedEvents = emittedEvents().filter(
      (event) => event.operation === "cron.abandoned_reminders",
    )
    expect(abandonedEvents.map((event) => event.stage)).toEqual([
      "start",
      "failure",
    ])
    expect(JSON.stringify(abandonedEvents)).not.toContain(
      "recipient@example.test",
    )
  })
})
