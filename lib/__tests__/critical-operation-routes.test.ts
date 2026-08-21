import { Webhook } from "svix"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
  wasEmailSent: vi.fn(),
  getTemplateSubject: vi.fn(),
  getTemplateBody: vi.fn(),
  deliverCronReminder: vi.fn(),
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
vi.mock("@/lib/email/cron-reminder-delivery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email/cron-reminder-delivery")>()
  return {
    ...original,
    deliverCronReminder: mocks.deliverCronReminder,
  }
})
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
    mocks.deliverCronReminder.mockImplementation(
      async ({ idempotencyKey, send }: {
        idempotencyKey: string
        send: (idempotencyKey: string) => Promise<{ success?: boolean; resendId?: string }>
      }) => {
        const result = await send(idempotencyKey)
        return result?.success === true
          ? { status: "sent", providerId: result.resendId }
          : { status: "failed" }
      },
    )
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
        "abandoned: 0; interview reminders: 0; booking reminders: 0; stale leads shifted: 0",
      sent: 0,
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

  it("does not consume an abandoned-form reminder attempt when delivery outcome is inconclusive", async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
    const abandonedForm = {
      id: "abandonment-retry-1",
      last_activity_at: "2026-08-16T12:00:00.000Z",
      last_step_completed: 2,
      reminder_count: 1,
      repreneurs: {
        id: "repreneur-retry-1",
        first_name: "Retry",
        last_name: "Person",
        email: "retry@example.test",
        marketing_consent: true,
      },
    }
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "intake_abandonment_tracking"
          ? { select: vi.fn(() => chain({ data: [abandonedForm], error: null })), update }
          : chain({ data: [], error: null }),
      ),
    })
    mocks.wasEmailSent.mockResolvedValue(false)
    mocks.getTemplateSubject.mockResolvedValue("Reminder subject")
    mocks.sendEmail.mockResolvedValue({})

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).sent).toBe(0)
    expect(update).not.toHaveBeenCalled()
  })

  it("records one reminder attempt after one conclusive abandoned-form delivery", async () => {
    const compareCount = vi.fn().mockResolvedValue({ error: null })
    const compareId = vi.fn(() => ({ eq: compareCount }))
    const update = vi.fn(() => ({ eq: compareId }))
    const abandonedForm = {
      id: "abandonment-delivered-1",
      last_activity_at: "2026-08-16T12:00:00.000Z",
      last_step_completed: 2,
      reminder_count: 0,
      repreneurs: {
        id: "repreneur-delivered-1",
        first_name: "Delivered",
        last_name: "Person",
        email: "delivered@example.test",
        marketing_consent: true,
      },
    }
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "intake_abandonment_tracking"
          ? { select: vi.fn(() => chain({ data: [abandonedForm], error: null })), update }
          : chain({ data: [], error: null }),
      ),
    })
    mocks.wasEmailSent.mockResolvedValue(false)
    mocks.getTemplateSubject.mockResolvedValue("Reminder subject")
    mocks.sendEmail.mockResolvedValue({ success: true })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect((await response.json()).sent).toBe(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(compareId).toHaveBeenCalledWith("id", "abandonment-delivered-1")
    expect(compareCount).toHaveBeenCalledWith("reminder_count", 0)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "cron-abandoned-abandonment-delivered-1-1",
      }),
    )
  })

  it("reconciles an abandoned reminder count after delivery completed before the prior run crashed", async () => {
    const compareCount = vi.fn().mockResolvedValue({ error: null })
    const compareId = vi.fn(() => ({ eq: compareCount }))
    const update = vi.fn(() => ({ eq: compareId }))
    const abandonedForm = {
      id: "abandonment-crash-recovery-1",
      last_activity_at: "2026-08-16T12:00:00.000Z",
      last_step_completed: 2,
      reminder_count: 0,
      repreneurs: {
        id: "repreneur-crash-recovery-1",
        first_name: "Crash",
        last_name: "Recovery",
        email: "recovery@example.test",
        marketing_consent: true,
      },
    }
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "intake_abandonment_tracking"
          ? { select: vi.fn(() => chain({ data: [abandonedForm], error: null })), update }
          : chain({ data: [], error: null }),
      ),
    })
    mocks.wasEmailSent.mockResolvedValue(false)
    mocks.getTemplateSubject.mockResolvedValue("Reminder subject")
    mocks.deliverCronReminder.mockResolvedValue({ status: "already_sent" })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).sent).toBe(0)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ reminder_count: 1 }))
    expect(compareId).toHaveBeenCalledWith("id", "abandonment-crash-recovery-1")
    expect(compareCount).toHaveBeenCalledWith("reminder_count", 0)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("uses stable event keys for interview and booking reminder deliveries", async () => {
    let activitiesRead = 0
    let repreneursRead = 0
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "intake_abandonment_tracking") {
          return chain({ data: [], error: null })
        }
        if (table === "activities") {
          activitiesRead++
          return chain({
            data: activitiesRead === 1
              ? [{
                  id: "interview-activity-1",
                  repreneur_id: "interview-repreneur-1",
                  event_date: "2026-08-22",
                  notes: null,
                  repreneur: {
                    id: "interview-repreneur-1",
                    first_name: "Interview",
                    last_name: "Person",
                    email: "interview@example.test",
                  },
                }]
              : [],
            error: null,
          })
        }
        if (table === "repreneurs") {
          repreneursRead++
          if (repreneursRead === 1) {
            return chain({
              data: [{
                id: "booking-repreneur-1",
                first_name: "Booking",
                last_name: "Person",
                email: "booking@example.test",
                lifecycle_status: "lead",
                created_at: "2026-08-15T12:00:00.000Z",
                marketing_consent: true,
              }],
              error: null,
            })
          }
          return {
            select: vi.fn(() => chain({ data: [], error: null })),
            update: vi.fn(),
          }
        }
        return chain({ data: [], error: null })
      }),
    })
    mocks.wasEmailSent.mockResolvedValue(false)
    mocks.getTemplateSubject.mockResolvedValue("Reminder subject")
    mocks.getTemplateBody.mockResolvedValue("Reminder body")
    mocks.sendEmail.mockResolvedValue({ success: true })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      interviewSent: 1,
      bookingSent: 1,
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "interview_reminder",
        idempotencyKey:
          "cron-interview-interview-activity-1-2026-08-22",
      }),
    )
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "booking_reminder",
        idempotencyKey: "cron-booking-booking-repreneur-1",
      }),
    )
  })

  it("shifts only stale leads with no live offer, pursuit, external dossier, or interview", async () => {
    const updateIn = vi.fn().mockResolvedValue({ error: null })
    const repreneurUpdate = vi.fn(() => ({ in: updateIn }))
    const staleCandidates = [
      { id: "stale-unengaged" },
      { id: "stale-interview" },
      { id: "stale-offered" },
      { id: "stale-accepted" },
      { id: "stale-active-legacy" },
      { id: "stale-pursuit" },
      { id: "stale-external" },
      { id: "stale-completed-offer" },
    ]
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "intake_abandonment_tracking") return chain({ data: [], error: null })
        if (table === "repreneurs") {
          return {
            select: vi.fn(() => chain({ data: staleCandidates, error: null })),
            update: repreneurUpdate,
          }
        }
        if (table === "activities") return chain({ data: [{ repreneur_id: "stale-interview" }], error: null })
        if (table === "repreneur_offers") {
          return chain({
            data: [
              { repreneur_id: "stale-offered" },
              { repreneur_id: "stale-accepted" },
              { repreneur_id: "stale-active-legacy" },
            ],
            error: null,
          })
        }
        if (table === "opportunity_matches") return chain({ data: [{ repreneur_id: "stale-pursuit" }], error: null })
        if (table === "external_pursuits") return chain({ data: [{ owner_repreneur_id: "stale-external" }], error: null })
        return chain({ data: [], error: null })
      }),
    })

    const response = await runDailyCron(
      new Request("http://localhost/api/cron/abandoned-forms", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    )

    expect(response.status).toBe(200)
    expect((await response.json()).staleShifted).toBe(2)
    expect(updateIn).toHaveBeenCalledWith("id", ["stale-unengaged", "stale-completed-offer"])
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
