import { describe, expect, it, vi } from "vitest"
import {
  expressLockedOpportunityInterest,
  lockedOpportunityInterestIdempotencyKey,
  type LockedOpportunityInterestNotificationDetails,
  type LockedOpportunityInterestRecord,
  type LockedOpportunityInterestStore,
} from "@/lib/locked-opportunity-interest"

const NOW = "2026-07-15T12:00:00.000Z"
const DETAILS: LockedOpportunityInterestNotificationDetails = {
  repreneurId: "repreneur-1",
  repreneurName: "Sophie Martin",
  repreneurEmail: "sophie@example.com",
  opportunityId: "opportunity-1",
  opportunityReference: "RN-1042",
  opportunityTitle: "Precision manufacturing business",
}

function createStore(record: LockedOpportunityInterestRecord) {
  return {
    recordInterest: vi.fn(async () => record),
    getNotificationDetails: vi.fn(async () => DETAILS),
    markNotificationSent: vi.fn(async () => undefined),
  } satisfies LockedOpportunityInterestStore
}

describe("locked opportunity interest", () => {
  it("records the private signal, emails the exact context, and marks delivery", async () => {
    const store = createStore({
      matchId: "match-1",
      expressedAt: NOW,
      notificationSentAt: null,
    })
    const notifier = { send: vi.fn(async () => ({ success: true })) }

    const result = await expressLockedOpportunityInterest(
      {
        opportunityId: DETAILS.opportunityId,
        repreneurId: DETAILS.repreneurId,
        actorId: "user-1",
        now: NOW,
      },
      { store, notifier },
    )

    expect(result).toEqual({
      status: "success",
      alreadyRecorded: false,
      expressedAt: NOW,
    })
    expect(store.recordInterest).toHaveBeenCalledWith({
      opportunityId: DETAILS.opportunityId,
      repreneurId: DETAILS.repreneurId,
      actorId: "user-1",
      expressedAt: NOW,
    })
    expect(notifier.send).toHaveBeenCalledWith({
      ...DETAILS,
      expressedAt: NOW,
      idempotencyKey: lockedOpportunityInterestIdempotencyKey("match-1", NOW),
    })
    expect(store.markNotificationSent).toHaveBeenCalledWith({
      matchId: "match-1",
      repreneurId: DETAILS.repreneurId,
      opportunityId: DETAILS.opportunityId,
      sentAt: NOW,
    })
  })

  it("is a no-op when the interest and notification were already recorded", async () => {
    const store = createStore({
      matchId: "match-1",
      expressedAt: NOW,
      notificationSentAt: "2026-07-15T12:00:01.000Z",
    })
    const notifier = { send: vi.fn(async () => ({ success: true })) }

    const result = await expressLockedOpportunityInterest(
      {
        opportunityId: DETAILS.opportunityId,
        repreneurId: DETAILS.repreneurId,
        actorId: "user-1",
        now: "2026-07-15T12:10:00.000Z",
      },
      { store, notifier },
    )

    expect(result).toEqual({
      status: "success",
      alreadyRecorded: true,
      expressedAt: NOW,
    })
    expect(store.getNotificationDetails).not.toHaveBeenCalled()
    expect(notifier.send).not.toHaveBeenCalled()
    expect(store.markNotificationSent).not.toHaveBeenCalled()
  })

  it("keeps the signal retryable when the staff email fails", async () => {
    const store = createStore({
      matchId: "match-1",
      expressedAt: NOW,
      notificationSentAt: null,
    })
    const notifier = {
      send: vi.fn(async () => ({ success: false, error: "test-safe failure" })),
    }

    const result = await expressLockedOpportunityInterest(
      {
        opportunityId: DETAILS.opportunityId,
        repreneurId: DETAILS.repreneurId,
        actorId: "user-1",
        now: NOW,
      },
      { store, notifier },
    )

    expect(result).toEqual({
      status: "notification_failed",
      expressedAt: NOW,
    })
    expect(store.markNotificationSent).not.toHaveBeenCalled()
  })
})
