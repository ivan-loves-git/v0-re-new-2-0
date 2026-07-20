export interface OpportunityMemoNotificationClaim {
  matchId: string
  opportunityId: string
  repreneurId: string
  recipientEmail: string
  repreneurFirstName: string
  opportunityTitle: string
}

export interface OpportunityMemoNotificationStore {
  claim(input: {
    opportunityId: string
    matchId?: string
    attemptedAt: string
  }): Promise<OpportunityMemoNotificationClaim | null>
  markSent(input: {
    matchId: string
    sentAt: string
    providerId?: string
  }): Promise<void>
  markFailed(input: {
    matchId: string
    failedAt: string
    error: string
  }): Promise<void>
}

export interface OpportunityMemoNotifier {
  send(input: OpportunityMemoNotificationClaim & {
    idempotencyKey: string
  }): Promise<{ success: boolean; resendId?: string; error?: string }>
}

export type OpportunityMemoNotificationOutcome =
  | { status: "not_claimed" }
  | { status: "sent"; matchId: string }
  | { status: "failed"; matchId: string; error: string }

export function opportunityMemoNotificationIdempotencyKey(matchId: string) {
  return `opportunity-memo-available-${matchId}`
}

export async function notifyOpportunityMemoAvailable(
  input: {
    opportunityId: string
    matchId?: string
    now: string
  },
  dependencies: {
    store: OpportunityMemoNotificationStore
    notifier: OpportunityMemoNotifier
  },
): Promise<OpportunityMemoNotificationOutcome> {
  const claim = await dependencies.store.claim({
    opportunityId: input.opportunityId,
    matchId: input.matchId,
    attemptedAt: input.now,
  })

  if (!claim) return { status: "not_claimed" }

  const idempotencyKey = opportunityMemoNotificationIdempotencyKey(claim.matchId)

  try {
    const delivery = await dependencies.notifier.send({
      ...claim,
      idempotencyKey,
    })

    if (!delivery.success) {
      const error = delivery.error ?? "Email delivery failed"
      await dependencies.store.markFailed({
        matchId: claim.matchId,
        failedAt: input.now,
        error,
      })
      return { status: "failed", matchId: claim.matchId, error }
    }

    await dependencies.store.markSent({
      matchId: claim.matchId,
      sentAt: input.now,
      providerId: delivery.resendId,
    })

    return { status: "sent", matchId: claim.matchId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed"

    try {
      await dependencies.store.markFailed({
        matchId: claim.matchId,
        failedAt: input.now,
        error: message,
      })
    } catch {
      // Leave the database lease to expire. A later trigger reuses the same
      // provider idempotency key, so recovering from an interrupted attempt is safe.
    }

    return { status: "failed", matchId: claim.matchId, error: message }
  }
}
