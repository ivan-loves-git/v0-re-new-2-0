import { createAdminClient } from "@/lib/supabase/admin"

export type NotificationDeliveryClaim =
  | { status: "claimed"; leaseToken: string }
  | { status: "busy" }
  | { status: "sent" }

export interface NotificationDeliveryStore {
  claim(idempotencyKey: string): Promise<NotificationDeliveryClaim>
  markSent(idempotencyKey: string, leaseToken: string, providerId?: string): Promise<void>
  markFailed(idempotencyKey: string, leaseToken: string): Promise<void>
}

type NotificationSendResult = {
  success?: boolean
  resendId?: string
  error?: string
}

type NotificationDeliveryInput = {
  idempotencyKey: string
  send(idempotencyKey: string): Promise<NotificationSendResult>
  store?: NotificationDeliveryStore
}

export const cronReminderIdempotencyKey = {
  abandoned: (trackingId: string, reminderNumber: number) => `cron-abandoned-${trackingId}-${reminderNumber}`,
  interview: (activityId: string, eventDate: string) => `cron-interview-${activityId}-${eventDate}`,
  booking: (repreneurId: string) => `cron-booking-${repreneurId}`,
}

export const notificationIdempotencyKey = {
  offerReceived: (assignmentId: string) => `offer-received:${assignmentId}`,
  milestoneCompleted: (milestoneId: string, completedAt: string) => `milestone-completed:${milestoneId}:${completedAt}`,
}

function parseClaim(data: unknown): NotificationDeliveryClaim | null {
  if (!data || typeof data !== "object") return null

  const status = "status" in data ? data.status : null
  if (status === "busy" || status === "sent") return { status }
  if (
    status === "claimed" &&
    "leaseToken" in data &&
    typeof data.leaseToken === "string" &&
    data.leaseToken.length > 0
  ) {
    return { status, leaseToken: data.leaseToken }
  }
  return null
}

const databaseStore: NotificationDeliveryStore = {
  async claim(idempotencyKey) {
    const { data, error } = await createAdminClient().rpc("claim_notification_delivery", {
      p_idempotency_key: idempotencyKey,
    })
    const claim = parseClaim(data)
    if (error || !claim) {
      throw new Error("Could not claim notification delivery.")
    }
    return claim
  },

  async markSent(idempotencyKey, leaseToken, providerId) {
    const { data, error } = await createAdminClient().rpc("complete_notification_delivery", {
      p_idempotency_key: idempotencyKey,
      p_lease_token: leaseToken,
      p_succeeded: true,
      p_provider_message_id: providerId ?? null,
    })
    if (error || data !== "sent") {
      throw new Error("Could not complete notification delivery.")
    }
  },

  async markFailed(idempotencyKey, leaseToken) {
    const { data, error } = await createAdminClient().rpc("complete_notification_delivery", {
      p_idempotency_key: idempotencyKey,
      p_lease_token: leaseToken,
      p_succeeded: false,
      p_provider_message_id: null,
    })
    if (error || !["failed", "stale", "sent"].includes(String(data))) {
      throw new Error("Could not release notification delivery.")
    }
  },
}

export type NotificationDeliveryResult =
  | { status: "busy" }
  | { status: "already_sent" }
  | { status: "failed"; error?: string }
  | { status: "sent"; providerId?: string }

export async function deliverNotification({
  idempotencyKey,
  send,
  store = databaseStore,
}: NotificationDeliveryInput): Promise<NotificationDeliveryResult> {
  const claim = await store.claim(idempotencyKey)
  if (claim.status === "busy") return { status: "busy" }
  if (claim.status === "sent") return { status: "already_sent" }

  try {
    const delivery = await send(idempotencyKey)
    if (delivery?.success !== true) {
      await store.markFailed(idempotencyKey, claim.leaseToken)
      return {
        status: "failed",
        ...(delivery?.error ? { error: delivery.error } : {}),
      }
    }

    await store.markSent(idempotencyKey, claim.leaseToken, delivery.resendId)
    return { status: "sent", providerId: delivery.resendId }
  } catch (error) {
    try {
      await store.markFailed(idempotencyKey, claim.leaseToken)
    } catch {
      // The database lease releases interrupted attempts. The completion RPC
      // fences this attempt from overwriting a newer lease or a sent record.
    }
    return {
      status: "failed",
      ...(error instanceof Error ? { error: error.message } : {}),
    }
  }
}
