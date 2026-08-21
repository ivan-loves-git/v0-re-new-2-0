export type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"

const TERMINAL_STATUSES = new Set(["bounced", "complained"])
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
}

/**
 * Provider webhooks can arrive more than once and out of order. Once a
 * recipient has bounced or complained, a late delivery/open/click must not
 * make the record look healthy again.
 */
export function resolveResendWebhookUpdate(
  currentStatus: string,
  eventType: ResendWebhookEventType,
  occurredAt: string,
): Record<string, string> | null {
  if (TERMINAL_STATUSES.has(currentStatus)) return null

  const statusByEvent: Record<ResendWebhookEventType, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
  }

  const status = statusByEvent[eventType]
  if (eventType === "email.bounced" || eventType === "email.complained") {
    return { status }
  }
  if ((STATUS_RANK[status] ?? 0) <= (STATUS_RANK[currentStatus] ?? 0)) return null
  if (eventType === "email.sent") return { status }
  if (eventType === "email.delivered") return { status, delivered_at: occurredAt }
  if (eventType === "email.opened") return { status, opened_at: occurredAt }
  return { status, clicked_at: occurredAt }
}
