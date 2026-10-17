import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"
import { deliverNotification } from "./notification-delivery"
import { sendEmail } from "./send-email"
import { pauseNotificationPayload, renderOpportunityPauseCopy } from "./opportunity-pause-copy"
import { OpportunityPausedEmail } from "./templates/opportunity-paused"

export async function getOpportunityPausePayload(notificationId: string) {
  const { data, error } = await createAdminClient().rpc("opportunity_pause_notification_payload", { p_notification_id: notificationId })
  if (error) throw new Error("Could not verify pause notification eligibility.")
  const parsed = pauseNotificationPayload.safeParse(data)
  return parsed.success && parsed.data.notificationId === notificationId ? parsed.data : null
}

export async function deliverOpportunityPauseNotification(notificationId: string) {
  return deliverNotification({
    idempotencyKey: `opportunity-pause:${notificationId}`,
    send: async (idempotencyKey) => {
      const payload = await getOpportunityPausePayload(notificationId)
      if (!payload) return { success: false, error: "Pause notification is no longer eligible." }
      const copy = renderOpportunityPauseCopy(payload)
      return sendEmail({
        to: payload.recipientEmail, repreneurId: payload.repreneurId,
        templateKey: "opportunity_paused", subject: copy.subject, react: OpportunityPausedEmail(copy), idempotencyKey,
        sourceContext: { kind: "opportunity_pause", notificationId, pauseId: payload.pauseId, matchId: payload.matchId },
        beforeProviderAttempt: async () => {
          const current = await getOpportunityPausePayload(notificationId)
          return current !== null && JSON.stringify(current) === JSON.stringify(payload)
        },
      })
    },
  })
}

export async function runPendingOpportunityPauseNotifications({ pauseId = null, limit = 4, budgetMs = 40_000 }: {
  pauseId?: string | null
  limit?: number
  budgetMs?: number
} = {}) {
  const { data, error } = await createAdminClient().rpc("pending_opportunity_pause_notifications", { p_pause_id: pauseId, p_limit: limit })
  const parsed = z.array(z.object({ id: z.string().uuid() })).safeParse(data)
  if (error || !parsed.success) throw new Error("Could not read pause notification queue.")
  const started = Date.now()
  const result = { processed: 0, sent: 0, failed: 0, reviewRequired: 0, budgetDeferred: 0 }
  for (const notification of parsed.data) {
    if (Date.now() - started >= budgetMs) break
    const delivery = await deliverOpportunityPauseNotification(notification.id)
    result.processed++
    if (delivery.status === "sent" || delivery.status === "already_sent") result.sent++
    if (delivery.status === "failed") result.failed++
    if (delivery.status === "review_required") result.reviewRequired++
  }
  result.budgetDeferred = parsed.data.length - result.processed
  return result
}
