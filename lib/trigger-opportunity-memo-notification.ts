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

    return outcomes.every((outcome) => outcome.status !== "failed")
  } catch {
    // The staff mutation already succeeded. Keep the delivery record retryable
    // rather than making the user repeat an upload or confidentiality update.
    return false
  }
}
