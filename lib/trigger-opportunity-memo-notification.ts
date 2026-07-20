import "server-only"

import { createOpportunityMemoNotificationStore } from "@/lib/data/opportunity-memo-notification"
import { sendOpportunityMemoAvailableEmail } from "@/lib/email/opportunity-memo-available"
import { notifyOpportunityMemoAvailable } from "@/lib/opportunity-memo-notification"

export async function triggerOpportunityMemoNotification(input: {
  opportunityId: string
  matchId?: string
}) {
  try {
    const outcome = await notifyOpportunityMemoAvailable(
      {
        opportunityId: input.opportunityId,
        matchId: input.matchId,
        now: new Date().toISOString(),
      },
      {
        store: createOpportunityMemoNotificationStore(),
        notifier: { send: sendOpportunityMemoAvailableEmail },
      },
    )

    if (outcome.status === "failed") {
      console.error("Failed to notify repreneur that an info memo is available", {
        matchId: outcome.matchId,
        error: outcome.error,
      })
    }
  } catch (error) {
    // The staff mutation already succeeded. Keep the delivery record retryable
    // rather than making the user repeat an upload or confidentiality update.
    console.error("Could not prepare repreneur info memo notification", error)
  }
}
