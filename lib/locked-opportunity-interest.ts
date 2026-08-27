export interface LockedOpportunityInterestRecord {
  matchId: string
  expressedAt: string
  notificationSentAt: string | null
  /** DEMO activity remains in the UAT namespace and never sends a real alert. */
  notificationSuppressed?: boolean
}

export interface LockedOpportunityInterestNotificationDetails {
  repreneurId: string
  repreneurName: string
  repreneurEmail: string
  opportunityId: string
  opportunityReference: string
  opportunityTitle: string
  hasOtherActivePursuit: boolean
}

export interface LockedOpportunityInterestStore {
  recordInterest(input: {
    opportunityId: string
    repreneurId: string
    actorId: string
    expressedAt: string
  }): Promise<LockedOpportunityInterestRecord>
  getNotificationDetails(input: {
    opportunityId: string
    repreneurId: string
  }): Promise<LockedOpportunityInterestNotificationDetails>
  markNotificationSent(input: {
    matchId: string
    repreneurId: string
    opportunityId: string
    sentAt: string
  }): Promise<void>
}

export interface LockedOpportunityInterestNotifier {
  send(input: LockedOpportunityInterestNotificationDetails & {
    expressedAt: string
    idempotencyKey: string
  }): Promise<{ success: boolean; error?: string }>
}

export type LockedOpportunityInterestOutcome =
  | {
      status: "success"
      alreadyRecorded: boolean
      expressedAt: string
    }
  | {
      status: "notification_failed"
      expressedAt: string
    }

export class LockedOpportunityInterestUnavailableError extends Error {
  constructor() {
    super("Locked opportunity interest is not available")
    this.name = "LockedOpportunityInterestUnavailableError"
  }
}

export function lockedOpportunityInterestIdempotencyKey(
  matchId: string,
  expressedAt: string,
) {
  return `locked-interest-${matchId}-${Date.parse(expressedAt)}`
}

/**
 * Records a repreneur's own interest in an eligible visible deal. The store
 * owns the eligibility transaction: this service intentionally never turns an
 * interest signal into a pursuit or changes confidentiality.
 */
export async function expressOpportunityInterest(
  input: {
    opportunityId: string
    repreneurId: string
    actorId: string
    now: string
  },
  dependencies: {
    store: LockedOpportunityInterestStore
    notifier: LockedOpportunityInterestNotifier
  },
): Promise<LockedOpportunityInterestOutcome> {
  const interest = await dependencies.store.recordInterest({
    opportunityId: input.opportunityId,
    repreneurId: input.repreneurId,
    actorId: input.actorId,
    expressedAt: input.now,
  })

  if (interest.notificationSentAt) {
    return {
      status: "success",
      alreadyRecorded: true,
      expressedAt: interest.expressedAt,
    }
  }

  if (interest.notificationSuppressed) {
    return {
      status: "success",
      alreadyRecorded: false,
      expressedAt: interest.expressedAt,
    }
  }

  try {
    const details = await dependencies.store.getNotificationDetails({
      opportunityId: input.opportunityId,
      repreneurId: input.repreneurId,
    })
    const notification = await dependencies.notifier.send({
      ...details,
      expressedAt: interest.expressedAt,
      idempotencyKey: lockedOpportunityInterestIdempotencyKey(
        interest.matchId,
        interest.expressedAt,
      ),
    })

    if (!notification.success) {
      return {
        status: "notification_failed",
        expressedAt: interest.expressedAt,
      }
    }

    await dependencies.store.markNotificationSent({
      matchId: interest.matchId,
      repreneurId: input.repreneurId,
      opportunityId: input.opportunityId,
      sentAt: input.now,
    })
  } catch {
    return {
      status: "notification_failed",
      expressedAt: interest.expressedAt,
    }
  }

  return {
    status: "success",
    alreadyRecorded: false,
    expressedAt: interest.expressedAt,
  }
}
