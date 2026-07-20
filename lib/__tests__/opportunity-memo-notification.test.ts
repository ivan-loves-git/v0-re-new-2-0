import { render } from "@react-email/render"
import { describe, expect, it, vi } from "vitest"
import { OpportunityMemoAvailableEmail } from "@/lib/email/templates/opportunity-memo-available"
import {
  notifyOpportunityMemoAvailable,
  opportunityMemoNotificationIdempotencyKey,
  type OpportunityMemoNotificationClaim,
  type OpportunityMemoNotificationStore,
} from "@/lib/opportunity-memo-notification"

const NOW = "2026-07-20T09:00:00.000Z"
const CLAIM: OpportunityMemoNotificationClaim = {
  matchId: "match-1",
  opportunityId: "opportunity-1",
  repreneurId: "repreneur-1",
  recipientEmail: "sophie@example.com",
  repreneurFirstName: "Sophie",
  opportunityTitle: "Entreprise de mécanique de précision",
}

function createStore(claim: OpportunityMemoNotificationClaim | null) {
  return {
    claim: vi.fn(async () => claim),
    markSent: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  } satisfies OpportunityMemoNotificationStore
}

describe("opportunity memo availability notification", () => {
  it("does not send before the database confidentiality gate grants a claim", async () => {
    const store = createStore(null)
    const notifier = { send: vi.fn(async () => ({ success: true })) }

    const result = await notifyOpportunityMemoAvailable(
      { opportunityId: CLAIM.opportunityId, matchId: CLAIM.matchId, now: NOW },
      { store, notifier },
    )

    expect(result).toEqual({ status: "not_claimed" })
    expect(notifier.send).not.toHaveBeenCalled()
    expect(store.markSent).not.toHaveBeenCalled()
  })

  it("sends the first eligible notification and completes its durable record", async () => {
    const store = createStore(CLAIM)
    const notifier = {
      send: vi.fn(async () => ({ success: true, resendId: "provider-1" })),
    }

    const result = await notifyOpportunityMemoAvailable(
      { opportunityId: CLAIM.opportunityId, matchId: CLAIM.matchId, now: NOW },
      { store, notifier },
    )

    expect(result).toEqual({ status: "sent", matchId: CLAIM.matchId })
    expect(notifier.send).toHaveBeenCalledWith({
      ...CLAIM,
      idempotencyKey: opportunityMemoNotificationIdempotencyKey(CLAIM.matchId),
    })
    expect(store.markSent).toHaveBeenCalledWith({
      matchId: CLAIM.matchId,
      sentAt: NOW,
      providerId: "provider-1",
    })
  })

  it("keeps a failed delivery retryable with the same idempotency key", async () => {
    const store = createStore(CLAIM)
    const notifier = {
      send: vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: "test-safe failure" })
        .mockResolvedValueOnce({ success: true, resendId: "provider-1" }),
    }

    const first = await notifyOpportunityMemoAvailable(
      { opportunityId: CLAIM.opportunityId, matchId: CLAIM.matchId, now: NOW },
      { store, notifier },
    )
    const second = await notifyOpportunityMemoAvailable(
      {
        opportunityId: CLAIM.opportunityId,
        matchId: CLAIM.matchId,
        now: "2026-07-20T09:01:00.000Z",
      },
      { store, notifier },
    )

    expect(first).toEqual({
      status: "failed",
      matchId: CLAIM.matchId,
      error: "test-safe failure",
    })
    expect(second).toEqual({ status: "sent", matchId: CLAIM.matchId })
    expect(store.markFailed).toHaveBeenCalledTimes(1)
    expect(store.markSent).toHaveBeenCalledTimes(1)
    expect(notifier.send.mock.calls[0]?.[0].idempotencyKey).toBe(
      notifier.send.mock.calls[1]?.[0].idempotencyKey,
    )
  })

  it("does not resend after a later memo edit once the store reports delivery", async () => {
    const store = createStore(CLAIM)
    const notifier = { send: vi.fn(async () => ({ success: true })) }

    await notifyOpportunityMemoAvailable(
      { opportunityId: CLAIM.opportunityId, matchId: CLAIM.matchId, now: NOW },
      { store, notifier },
    )
    store.claim.mockResolvedValueOnce(null)
    const editResult = await notifyOpportunityMemoAvailable(
      {
        opportunityId: CLAIM.opportunityId,
        matchId: CLAIM.matchId,
        now: "2026-07-20T10:00:00.000Z",
      },
      { store, notifier },
    )

    expect(editResult).toEqual({ status: "not_claimed" })
    expect(notifier.send).toHaveBeenCalledTimes(1)
  })

  it("renders only repreneur-safe public opportunity context", async () => {
    const html = await render(
      OpportunityMemoAvailableEmail({
        firstName: CLAIM.repreneurFirstName,
        opportunityTitle: CLAIM.opportunityTitle,
        opportunityUrl: `https://app.re-new.team/portal/deals/${CLAIM.matchId}`,
      }),
    )

    expect(html).toContain("Sophie")
    expect(html).toContain("Entreprise de mécanique de précision")
    expect(html).toContain(`/portal/deals/${CLAIM.matchId}`)
    expect(html).not.toContain("Cabinet source secret")
    expect(html).not.toContain("contact-interne@example.com")
  })
})
