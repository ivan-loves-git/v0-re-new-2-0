import { describe, expect, it, vi } from "vitest"

import {
  deliverNotification,
  notificationIdempotencyKey,
  type NotificationDeliveryClaim,
  type NotificationDeliveryStore,
} from "@/lib/email/notification-delivery"

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function fencedStore() {
  let status: "available" | "pending" | "sent" | "failed" = "available"
  let currentToken: string | null = null
  let tokenNumber = 0

  const store: NotificationDeliveryStore = {
    claim: vi.fn(async (): Promise<NotificationDeliveryClaim> => {
      if (status === "sent") return { status: "sent" }
      if (status === "pending") return { status: "busy" }
      currentToken = `lease-${++tokenNumber}`
      status = "pending"
      return { status: "claimed", leaseToken: currentToken }
    }),
    markSent: vi.fn(async (_key, leaseToken) => {
      if (status === "pending" && currentToken === leaseToken) status = "sent"
    }),
    markFailed: vi.fn(async (_key, leaseToken) => {
      if (status === "pending" && currentToken === leaseToken) status = "failed"
    }),
  }

  return {
    store,
    expireLease() {
      status = "failed"
      currentToken = null
    },
    status: () => status,
  }
}

describe("durable notification delivery", () => {
  it("allows one provider request when the same action is submitted concurrently", async () => {
    const state = fencedStore()
    const provider = deferred<{ success: true; resendId: string }>()
    const send = vi.fn(() => provider.promise)
    const input = {
      idempotencyKey: notificationIdempotencyKey.offerReceived("assignment-1"),
      send,
      store: state.store,
    }

    const first = deliverNotification(input)
    const second = deliverNotification(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    provider.resolve({ success: true, resendId: "provider-1" })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { status: "sent", providerId: "provider-1" },
      { status: "busy" },
    ])
    expect(send).toHaveBeenCalledWith(input.idempotencyKey)
  })

  it("keeps sent terminal when an expired older attempt reports failure late", async () => {
    const state = fencedStore()
    const oldProvider = deferred<{ success: false; error: string }>()
    const oldAttempt = deliverNotification({
      idempotencyKey: "offer-received-assignment-1",
      send: vi.fn(() => oldProvider.promise),
      store: state.store,
    })
    await vi.waitFor(() => expect(state.store.claim).toHaveBeenCalledTimes(1))

    state.expireLease()
    await expect(
      deliverNotification({
        idempotencyKey: "offer-received-assignment-1",
        send: vi.fn(async () => ({ success: true, resendId: "provider-new" })),
        store: state.store,
      }),
    ).resolves.toEqual({ status: "sent", providerId: "provider-new" })

    oldProvider.resolve({ success: false, error: "late failure" })
    await expect(oldAttempt).resolves.toEqual({
      status: "failed",
      error: "late failure",
    })
    expect(state.status()).toBe("sent")
  })

  it("uses one event key for an offer and a new key after milestone recompletion", () => {
    expect(notificationIdempotencyKey.offerReceived("assignment-1")).toBe(
      notificationIdempotencyKey.offerReceived("assignment-1"),
    )
    expect(notificationIdempotencyKey.milestoneCompleted("milestone-1", "2026-08-21T09:00:00.000Z")).not.toBe(
      notificationIdempotencyKey.milestoneCompleted("milestone-1", "2026-08-22T09:00:00.000Z"),
    )
  })
})
