import type { InterestNotificationStatus } from "@/lib/email/interest-notification-delivery"

/** The action must never say an uncertain provider result was not sent. */
export function interestRejectionFeedback(delivery: InterestNotificationStatus): string {
  if (delivery === "sent" || delivery === "already_sent") {
    return "Interest rejected; the neutral client notice was sent."
  }
  if (delivery === "suppressed") {
    return "Interest rejected. The client notice was not dispatched under the current notification settings."
  }
  return "Interest rejected. Client notice delivery is not confirmed; check its delivery status before assuming the client knows."
}
