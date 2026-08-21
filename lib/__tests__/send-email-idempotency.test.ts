import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  resendSend: vi.fn(),
  isSuppressed: vi.fn(),
  traceSuccess: vi.fn(),
  traceFailure: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/email/resend-client", () => ({
  resend: { emails: { send: mocks.resendSend } },
  FROM_EMAIL: "test@re-new.test",
  FROM_NAME: "Re-New Test",
  DAILY_EMAIL_LIMIT: 100,
}))
vi.mock("@/lib/email/ma-contact-email-authorization", () => ({
  isMaContactEmailAddressSuppressed: mocks.isSuppressed,
}))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: () => ({
    success: mocks.traceSuccess,
    failure: mocks.traceFailure,
  }),
}))

import { sendEmail } from "@/lib/email/send-email"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

type LogState = {
  id: string
  status: string
  resend_id: string | null
  sent_at: string | null
  daily_counted_at: string | null
  provider_attempted_at: string | null
  provider_outcome: "attempting" | "uncertain" | "rejected" | "accepted" | null
}

function emailParams() {
  return {
    to: "ada@example.test",
    subject: "TEST offer",
    repreneurId: "repreneur-1",
    templateKey: "offer_received" as const,
    react: null as never,
    idempotencyKey: "offer-received:assignment-1",
  }
}

function fakeEmailDatabase(options?: { initialLog?: LogState | null; loseFirstFinalizationResponse?: boolean }) {
  let log = options?.initialLog ?? null
  let insertedRows = 0
  let countedDeliveries = log?.daily_counted_at ? 1 : 0
  let finalizations = 0

  const emailLogs = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: log, error: null })),
      })),
    })),
    upsert: vi.fn((input: Record<string, unknown>) => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => {
          if (!log) {
            insertedRows += 1
            log = {
              id: "email-log-1",
              status: String(input.status ?? "pending"),
              resend_id: null,
              sent_at: null,
              daily_counted_at: null,
              provider_attempted_at: null,
              provider_outcome: null,
            }
          }
          return { data: log, error: null }
        }),
      })),
    })),
    update: vi.fn((updates: Record<string, unknown>) => ({
      eq: vi.fn(() => ({
        in: vi.fn((_field: string, statuses: string[]) => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (!log || !statuses.includes(log.status)) return { data: null, error: null }
              log = { ...log, ...updates }
              return { data: { id: log.id }, error: null }
            }),
          })),
        })),
      })),
    })),
  }

  const client = {
    from: vi.fn((table: string) => {
      if (table === "email_logs") return emailLogs
      if (table === "email_templates") {
        return {
          select: vi.fn((field: string) => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: field === "is_active" ? { is_active: true } : { requires_consent: false },
                error: null,
              })),
            })),
          })),
        }
      }
      if (table === "email_daily_counts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { count: countedDeliveries },
                error: null,
              })),
            })),
          })),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
    rpc: vi.fn(async (name: string, input: Record<string, unknown>) => {
      expect(name).toBe("finalize_idempotent_email_delivery")
      finalizations += 1
      if (log) {
        log = {
          ...log,
          status: "sent",
          resend_id: String(input.p_resend_id),
          sent_at: String(input.p_sent_at),
          daily_counted_at: log.daily_counted_at ?? String(input.p_sent_at),
          provider_outcome: "accepted",
        }
      }
      if (countedDeliveries === 0) countedDeliveries = 1
      if (options?.loseFirstFinalizationResponse && finalizations === 1) {
        return { data: null, error: { message: "response lost after commit" } }
      }
      return { data: true, error: null }
    }),
  }

  return {
    client,
    insertedRows: () => insertedRows,
    countedDeliveries: () => countedDeliveries,
    finalizations: () => finalizations,
    log: () => log,
  }
}

describe("idempotent email logging and accounting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isSuppressed.mockResolvedValue(false)
  })

  it("rejoins a terminal log without another provider request or daily count", async () => {
    const database = fakeEmailDatabase({
      initialLog: {
        id: "email-log-1",
        status: "sent",
        resend_id: "provider-1",
        sent_at: "2026-08-21T09:00:00.000Z",
        daily_counted_at: "2026-08-21T09:00:00.000Z",
        provider_attempted_at: "2026-08-21T09:00:00.000Z",
        provider_outcome: "accepted",
      },
    })
    mocks.createAdminClient.mockReturnValue(database.client)

    await expect(sendEmail(emailParams())).resolves.toEqual({
      success: true,
      emailLogId: "email-log-1",
      resendId: "provider-1",
    })
    expect(mocks.resendSend).not.toHaveBeenCalled()
    expect(database.finalizations()).toBe(0)
    expect(database.countedDeliveries()).toBe(1)
  })

  it("blocks a blind resend after an ambiguous attempt leaves the provider-safe window", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-22T10:00:00.000Z"))
    const database = fakeEmailDatabase({
      initialLog: {
        id: "email-log-1",
        status: "pending",
        resend_id: null,
        sent_at: null,
        daily_counted_at: null,
        provider_attempted_at: "2026-08-21T09:00:00.000Z",
        provider_outcome: "uncertain",
      },
    })
    mocks.createAdminClient.mockReturnValue(database.client)

    try {
      await expect(sendEmail(emailParams())).resolves.toMatchObject({
        success: false,
        emailLogId: "email-log-1",
        error: expect.stringContaining("Review the provider record"),
      })
    } finally {
      vi.useRealTimers()
    }

    expect(mocks.resendSend).not.toHaveBeenCalled()
    expect(database.log()).toMatchObject({
      status: "pending",
      provider_outcome: "uncertain",
    })
  })

  it("allows an old conclusive provider rejection to retry safely", async () => {
    const database = fakeEmailDatabase({
      initialLog: {
        id: "email-log-1",
        status: "failed",
        resend_id: null,
        sent_at: null,
        daily_counted_at: null,
        provider_attempted_at: "2026-08-01T09:00:00.000Z",
        provider_outcome: "rejected",
      },
    })
    mocks.createAdminClient.mockReturnValue(database.client)
    mocks.resendSend.mockResolvedValue({ data: { id: "provider-1" }, error: null })

    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: true,
      emailLogId: "email-log-1",
      resendId: "provider-1",
    })
    expect(mocks.resendSend).toHaveBeenCalledTimes(1)
    expect(database.log()).toMatchObject({
      status: "sent",
      provider_outcome: "accepted",
    })
  })

  it("retries a conclusive provider failure through the same log and counts success once", async () => {
    const database = fakeEmailDatabase()
    mocks.createAdminClient.mockReturnValue(database.client)
    mocks.resendSend
      .mockResolvedValueOnce({
        data: null,
        error: { message: "provider rejected" },
      })
      .mockResolvedValueOnce({ data: { id: "provider-1" }, error: null })

    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: false,
      emailLogId: "email-log-1",
      error: "provider rejected",
    })
    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: true,
      emailLogId: "email-log-1",
      resendId: "provider-1",
    })

    expect(database.insertedRows()).toBe(1)
    expect(database.countedDeliveries()).toBe(1)
    expect(database.finalizations()).toBe(1)
    expect(database.log()).toMatchObject({
      status: "sent",
      resend_id: "provider-1",
    })
  })

  it("converges after finalization committed but its response was lost", async () => {
    const database = fakeEmailDatabase({ loseFirstFinalizationResponse: true })
    mocks.createAdminClient.mockReturnValue(database.client)
    mocks.resendSend.mockResolvedValue({
      data: { id: "provider-1" },
      error: null,
    })

    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: false,
      emailLogId: "email-log-1",
    })
    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: true,
      emailLogId: "email-log-1",
      resendId: "provider-1",
    })

    expect(mocks.resendSend).toHaveBeenCalledTimes(1)
    expect(database.insertedRows()).toBe(1)
    expect(database.countedDeliveries()).toBe(1)
    expect(database.finalizations()).toBe(1)
  })

  it("retries an ambiguous provider exception within the safe window", async () => {
    const database = fakeEmailDatabase()
    mocks.createAdminClient.mockReturnValue(database.client)
    mocks.resendSend
      .mockRejectedValueOnce(new Error("network response lost"))
      .mockResolvedValueOnce({ data: { id: "provider-1" }, error: null })

    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: false,
      emailLogId: "email-log-1",
      error: "network response lost",
    })
    expect(database.log()).toMatchObject({
      status: "pending",
      provider_outcome: "uncertain",
    })

    await expect(sendEmail(emailParams())).resolves.toMatchObject({
      success: true,
      emailLogId: "email-log-1",
      resendId: "provider-1",
    })
    expect(mocks.resendSend).toHaveBeenCalledTimes(2)
    expect(database.countedDeliveries()).toBe(1)
  })

  it("does not let an older provider failure downgrade a newer sent log", async () => {
    const database = fakeEmailDatabase()
    mocks.createAdminClient.mockReturnValue(database.client)
    const oldProvider = deferred<{ data: null; error: { message: string } }>()
    const newProvider = deferred<{ data: { id: string }; error: null }>()
    mocks.resendSend
      .mockImplementationOnce(() => oldProvider.promise)
      .mockImplementationOnce(() => newProvider.promise)

    const oldAttempt = sendEmail(emailParams())
    const newAttempt = sendEmail(emailParams())
    await vi.waitFor(() => expect(mocks.resendSend).toHaveBeenCalledTimes(2))

    newProvider.resolve({ data: { id: "provider-1" }, error: null })
    await expect(newAttempt).resolves.toMatchObject({ success: true })
    oldProvider.resolve({ data: null, error: { message: "late failure" } })
    await expect(oldAttempt).resolves.toMatchObject({ success: false, error: "late failure" })

    expect(database.log()).toMatchObject({
      status: "sent",
      resend_id: "provider-1",
    })
    expect(database.countedDeliveries()).toBe(1)
  })
})
