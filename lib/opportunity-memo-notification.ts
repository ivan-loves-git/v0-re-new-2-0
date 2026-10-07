export interface OpportunityMemoNotificationClaim {
  matchId: string
  opportunityId: string
  repreneurId: string
  recipientEmail: string
  repreneurFirstName: string
  opportunityTitle: string
  grantEvidenceId?: string
  attemptToken?: string
}

export interface OpportunityMemoNotificationStore {
  claim(input: {
    opportunityId: string
    matchId?: string
    attemptedAt: string
    expectedGrantId?: string
  }): Promise<OpportunityMemoNotificationClaim | null>
  markSent(input: {
    matchId: string
    sentAt: string
    grantEvidenceId?: string
    attemptToken?: string
    providerId?: string
  }): Promise<void>
  markFailed(input: {
    matchId: string
    failedAt: string
    grantEvidenceId?: string
    attemptToken?: string
    outcome?: "review" | "deferred" | "rejected" | "uncertain"
    error: string
  }): Promise<void>
}

export interface OpportunityMemoNotifier {
  send(input: OpportunityMemoNotificationClaim & {
    idempotencyKey: string
  }): Promise<{ success: boolean; resendId?: string; error?: string; queued?: boolean; providerOutcome?: "accepted" | "rejected" | "blocked" | "deferred" | "fenced" | "uncertain" | "review" }>
}

export type OpportunityMemoNotificationOutcome =
  | { status: "not_claimed" }
  | { status: "sent"; matchId: string }
  | { status: "failed"; matchId: string; error: string }
  | { status: "review_required"; matchId: string }

export function opportunityMemoNotificationIdempotencyKey(matchId: string) {
  return `opportunity-memo-available-${matchId}`
}

export async function notifyOpportunityMemoAvailable(
  input: {
    opportunityId: string
    matchId?: string
    now: string
    expectedGrantId?: string
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
    ...(input.expectedGrantId ? { expectedGrantId: input.expectedGrantId } : {}),
  })

  if (!claim) return { status: "not_claimed" }

  const idempotencyKey = claim.grantEvidenceId ? `opportunity-memo-grant-${claim.grantEvidenceId}` : opportunityMemoNotificationIdempotencyKey(claim.matchId)
  const identity = claim.grantEvidenceId ? { grantEvidenceId: claim.grantEvidenceId, attemptToken: claim.attemptToken } : {}

  try {
    const delivery = await dependencies.notifier.send({
      ...claim,
      idempotencyKey,
    })

    if (delivery.queued) {
      await dependencies.store.markFailed({ matchId: claim.matchId, failedAt: input.now, error: "Prepared for staff review; no email sent.", ...identity, ...(claim.grantEvidenceId ? { outcome: "review" as const } : {}) })
      return { status: "review_required", matchId: claim.matchId }
    }
    if (!delivery.success || (claim.grantEvidenceId && !delivery.resendId)) {
      const error = delivery.error ?? (delivery.success ? "Provider acceptance is not confirmed" : "Email delivery failed")
      await dependencies.store.markFailed({
        matchId: claim.matchId,
        failedAt: input.now,
        error,
        ...identity,
        ...(claim.grantEvidenceId ? { outcome: delivery.providerOutcome === "rejected" ? "rejected" as const : ["blocked", "deferred", "fenced"].includes(delivery.providerOutcome ?? "") ? "deferred" as const : "uncertain" as const } : {}),
      })
      return { status: "failed", matchId: claim.matchId, error }
    }

    await dependencies.store.markSent({
      matchId: claim.matchId,
      sentAt: input.now,
      providerId: delivery.resendId,
      ...identity,
    })

    return { status: "sent", matchId: claim.matchId }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed"

    try {
      await dependencies.store.markFailed({
        matchId: claim.matchId,
        failedAt: input.now,
        error: message,
        ...identity,
        ...(claim.grantEvidenceId ? { outcome: "uncertain" as const } : {}),
      })
    } catch {
      // A versioned attempt remains Sending and blocks a blind retry until
      // reconciled. Legacy records retain their existing recovery semantics.
    }

    return { status: "failed", matchId: claim.matchId, error: message }
  }
}

export async function notifyOpportunityMemoCandidates(
  input: {
    opportunityId: string
    matchIds: string[]
    expectedGrantId?: string
    now: string
  },
  dependencies: {
    store: OpportunityMemoNotificationStore
    notifier: OpportunityMemoNotifier
  },
): Promise<OpportunityMemoNotificationOutcome[]> {
  const outcomes: OpportunityMemoNotificationOutcome[] = []

  for (const matchId of input.matchIds) {
    outcomes.push(await notifyOpportunityMemoAvailable({
      opportunityId: input.opportunityId,
      matchId,
      now: input.now,
      expectedGrantId: input.expectedGrantId,
    }, dependencies))
  }

  return outcomes
}
