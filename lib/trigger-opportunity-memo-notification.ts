import "server-only"

import { createOpportunityMemoNotificationStore } from "@/lib/data/opportunity-memo-notification"
import { sendOpportunityMemoAvailableEmail } from "@/lib/email/opportunity-memo-available"
import { notifyOpportunityMemoCandidates } from "@/lib/opportunity-memo-notification"

export async function triggerOpportunityMemoNotification(input: {
  opportunityId: string
  matchId: string
}) {
  try {
    const outcomes = await notifyOpportunityMemoCandidates(
      {
        opportunityId: input.opportunityId,
        matchIds: [input.matchId],
        now: new Date().toISOString(),
      },
      {
        store: createOpportunityMemoNotificationStore(),
        notifier: { send: sendOpportunityMemoAvailableEmail },
      },
    )

    for (const failed of outcomes) {
      if (failed.status !== "failed") continue
      console.error("Failed to notify repreneur that an info memo is available", {
        matchId: failed.matchId,
        error: failed.error,
      })
    }
  } catch (error) {
    // The staff mutation already succeeded. Keep the delivery record retryable
    // rather than making the user repeat an upload or confidentiality update.
    console.error("Could not prepare repreneur info memo notification", error)
  }
}
