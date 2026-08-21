import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  cronReminderIdempotencyKey,
  deliverCronReminder,
  type CronReminderDeliveryStore,
} from "@/lib/email/cron-reminder-delivery"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function inMemoryStore(): CronReminderDeliveryStore {
  const states = new Map<string, "pending" | "sent" | "failed">()
  const tokens = new Map<string, string>()
  let tokenNumber = 0

  return {
    claim: vi.fn(async (idempotencyKey) => {
      const state = states.get(idempotencyKey)
      if (state === "sent") return { status: "sent" as const }
      if (state === "pending") return { status: "busy" as const }
      const leaseToken = `lease-${++tokenNumber}`
      states.set(idempotencyKey, "pending")
      tokens.set(idempotencyKey, leaseToken)
      return { status: "claimed" as const, leaseToken }
    }),
    markSent: vi.fn(async (idempotencyKey, leaseToken) => {
      if (tokens.get(idempotencyKey) === leaseToken) states.set(idempotencyKey, "sent")
    }),
    markFailed: vi.fn(async (idempotencyKey, leaseToken) => {
      if (tokens.get(idempotencyKey) === leaseToken) states.set(idempotencyKey, "failed")
    }),
  }
}

describe("cron reminder delivery idempotency", () => {
  it("lets only one concurrent invocation reach the email provider", async () => {
    const store = inMemoryStore()
    const provider = deferred<{ success: true; resendId: string }>()
    const send = vi.fn(() => provider.promise)
    const input = {
      idempotencyKey: cronReminderIdempotencyKey.booking("repreneur-1"),
      send,
      store,
    }

    const first = deliverCronReminder(input)
    const second = deliverCronReminder(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    provider.resolve({ success: true, resendId: "provider-1" })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "sent", providerId: "provider-1" },
      { status: "busy" },
    ])
    expect(send).toHaveBeenCalledWith(input.idempotencyKey)
  })

  it("distinguishes an in-flight claim from a delivery already completed before a crash", async () => {
    const send = vi.fn()
    const busyStore: CronReminderDeliveryStore = {
      claim: vi.fn(async () => ({ status: "busy" as const })),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    }
    const sentStore: CronReminderDeliveryStore = {
      claim: vi.fn(async () => ({ status: "sent" as const })),
      markSent: vi.fn(),
      markFailed: vi.fn(),
    }

    await expect(
      deliverCronReminder({
        idempotencyKey: "cron-booking-repreneur-1",
        send,
        store: busyStore,
      }),
    ).resolves.toEqual({ status: "busy" })
    await expect(
      deliverCronReminder({
        idempotencyKey: "cron-abandoned-tracking-1-1",
        send,
        store: sentStore,
      }),
    ).resolves.toEqual({ status: "already_sent" })
    expect(send).not.toHaveBeenCalled()
  })

  it("releases a failed attempt for retry with the exact same provider key", async () => {
    const store = inMemoryStore()
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: "provider unavailable" })
      .mockResolvedValueOnce({ success: true, resendId: "provider-2" })
    const idempotencyKey = cronReminderIdempotencyKey.abandoned("tracking-1", 2)

    await expect(deliverCronReminder({ idempotencyKey, send, store })).resolves.toEqual({
      status: "failed",
      error: "provider unavailable",
    })
    await expect(deliverCronReminder({ idempotencyKey, send, store })).resolves.toEqual({
      status: "sent",
      providerId: "provider-2",
    })

    expect(send).toHaveBeenNthCalledWith(1, idempotencyKey)
    expect(send).toHaveBeenNthCalledWith(2, idempotencyKey)
    expect(store.markFailed).toHaveBeenCalledTimes(1)
    expect(store.markSent).toHaveBeenCalledTimes(1)
  })

  it("uses a new key only for a genuinely different reminder event", () => {
    expect(cronReminderIdempotencyKey.abandoned("tracking-1", 1)).not.toBe(
      cronReminderIdempotencyKey.abandoned("tracking-1", 2),
    )
    expect(cronReminderIdempotencyKey.interview("activity-1", "2026-08-22")).not.toBe(
      cronReminderIdempotencyKey.interview("activity-1", "2026-08-23"),
    )
    expect(cronReminderIdempotencyKey.booking("repreneur-1")).toBe(cronReminderIdempotencyKey.booking("repreneur-1"))
  })

  it("forwards the claimed key to the Resend SDK request options", () => {
    const source = readFileSync(join(process.cwd(), "lib/email/send-email.ts"), "utf8")

    expect(source).toContain("idempotencyKey ? { idempotencyKey } : undefined")
  })
})
