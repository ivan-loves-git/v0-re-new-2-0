import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(), sendEmail: vi.fn(), sendEmailDirect: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/email/send-email", () => ({
  sendEmail: mocks.sendEmail, sendEmailDirect: mocks.sendEmailDirect,
}))
vi.mock("@/lib/env", () => ({ env: { RENEW_STAFF_NOTIFICATION_EMAIL: "staff@example.test" } }))

import {
  deliverRecommendationCycleNotification, recommendationCycleNotificationKey,
  renderRecommendationCycleCopy, runPendingRecommendationCycleNotifications,
} from "@/lib/email/recommendation-cycle-delivery"

const cycleId = "75000000-0000-4000-8000-000000000101"
const leaseToken = "75000000-0000-4000-8000-000000000102"
const clientPayload = {
  cycleId, kind: "client_reminder" as const,
  matchId: "75000000-0000-4000-8000-000000000103",
  repreneurId: "75000000-0000-4000-8000-000000000104",
  recipientEmail: "buyer@example.test", firstName: "Sophie",
  repreneurName: "Sophie Martin", opportunityTitle: "Fictional public deal",
  templateKey: "recommendation_response_reminder" as const,
  subject: "Votre recommandation — {opportunityTitle}",
  body: "Bonjour {firstName}; {sourceOffice} {informationMemo} {staffNotes}.",
}
const staffPayload = {
  ...clientPayload, kind: "staff_expiry" as const, recipientEmail: "",
  templateKey: "recommendation_unanswered_staff_alert" as const,
}

function fakeDelivery(options?: {
  claimStatus?: string; payload?: unknown; payloadError?: boolean; completeResult?: string
}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "w175_claim_cycle_delivery") return { data: options?.claimStatus
      ? { status: options.claimStatus } : { status: "claimed", leaseToken }, error: null }
    if (name === "w175_cycle_delivery_payload") return {
      data: options?.payload === undefined ? clientPayload : options.payload,
      error: options?.payloadError ? { message: "synthetic DB read error" } : null,
    }
    if (name === "w175_begin_cycle_provider_attempt") return { data: true, error: null }
    if (name === "w175_complete_cycle_delivery") return {
      data: options?.completeResult ?? "suppressed", error: null,
    }
    throw new Error("Unexpected RPC " + name)
  })
  const maybeSingle = vi.fn().mockResolvedValue({ data: { provider_outcome: "rejected" }, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn().mockReturnValue({ select }) })
  return rpc
}

function fakeQueue(
  groups: Array<Array<{ cycle_id: string; kind: "client_reminder" | "staff_expiry" }>>,
  claim: (cycle: string, kind: string) => Promise<unknown>,
) {
  const queue = (data: Array<{ cycle_id: string; kind: string }>) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query),
      lte: vi.fn(() => query), order: vi.fn(() => query),
      limit: vi.fn(async () => ({ data, error: null })),
    }
    return query
  }
  const review = {
    select: vi.fn(() => review),
    eq: vi.fn(async () => ({ count: 0, error: null })),
  }
  const from = vi.fn()
    .mockReturnValueOnce(queue(groups[0]))
    .mockReturnValueOnce(queue(groups[1]))
    .mockReturnValueOnce(queue(groups[2]))
    .mockReturnValueOnce(queue(groups[3]))
    .mockReturnValueOnce(review)
  const rpc = vi.fn(async (name: string, args: { p_cycle_id: string; p_kind: string }) => {
    if (name !== "w175_claim_cycle_delivery") throw new Error("Unexpected RPC " + name)
    return { data: await claim(args.p_cycle_id, args.p_kind), error: null }
  })
  mocks.createAdminClient.mockReturnValue({ from, rpc })
}

describe("exact recommendation-cycle delivery", () => {
  beforeEach(() => vi.clearAllMocks())

  it("never revives a source-disabled event after staff enables its key", async () => {
    const rpc = fakeDelivery({ claimStatus: "suppressed" })
    await expect(deliverRecommendationCycleNotification(cycleId, "client_reminder"))
      .resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("binds a client send to the immutable cycle and kind and checks current payload", async () => {
    const rpc = fakeDelivery({ completeResult: "sent" })
    mocks.sendEmail.mockImplementation(async ({ to, idempotencyKey, beforeProviderAttempt }) => {
      expect(to).toBe("buyer@example.test")
      expect(idempotencyKey).toBe(recommendationCycleNotificationKey(cycleId, "client_reminder"))
      expect(await beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "provider-175", providerOutcome: "accepted" }
    })
    await expect(deliverRecommendationCycleNotification(cycleId, "client_reminder"))
      .resolves.toBe("sent")
    expect(rpc).toHaveBeenCalledWith("w175_begin_cycle_provider_attempt",
      expect.objectContaining({ p_cycle_id: cycleId, p_kind: "client_reminder", p_expected_payload: clientPayload }))
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })

  it("uses only the configured staff destination, never the client's mailbox", async () => {
    fakeDelivery({ payload: staffPayload, completeResult: "sent" })
    mocks.sendEmailDirect.mockImplementation(async ({ to, idempotencyKey, beforeProviderAttempt }) => {
      expect(to).toBe("staff@example.test")
      expect(idempotencyKey).toBe(recommendationCycleNotificationKey(cycleId, "staff_expiry"))
      expect(await beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "provider-staff-175", providerOutcome: "accepted" }
    })
    await expect(deliverRecommendationCycleNotification(cycleId, "staff_expiry"))
      .resolves.toBe("sent")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("surfaces canonical review-required after a blocked prior ambiguous attempt", async () => {
    fakeDelivery({ completeResult: "review_required" })
    mocks.sendEmail.mockResolvedValue({ success: false, providerOutcome: "blocked" })
    await expect(deliverRecommendationCycleNotification(cycleId, "client_reminder"))
      .resolves.toBe("review_required")
  })

  it("keeps committed intent retryable on a transient payload read error", async () => {
    const rpc = fakeDelivery({ payloadError: true })
    await expect(deliverRecommendationCycleNotification(cycleId, "client_reminder"))
      .resolves.toBe("failed")
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w175_complete_cycle_delivery")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("never substitutes private source or staff fields into client copy", () => {
    const copy = renderRecommendationCycleCopy(clientPayload)
    expect(copy.body).toContain("{sourceOffice}")
    expect(copy.body).toContain("{informationMemo}")
    expect(copy.body).toContain("{staffNotes}")
    expect(JSON.stringify(copy.variables)).not.toContain("sourceOffice")
  })

  it("fairly rotates fresh/retry and client/staff work in the bounded daily batch", async () => {
    const seen: string[] = []
    fakeQueue([
      [{ cycle_id: "client-fresh", kind: "client_reminder" }],
      [{ cycle_id: "staff-fresh", kind: "staff_expiry" }],
      [{ cycle_id: "client-retry", kind: "client_reminder" }],
      [{ cycle_id: "staff-retry", kind: "staff_expiry" }],
    ], async (id, kind) => {
      seen.push(id + ":" + kind)
      return { status: "suppressed" }
    })
    await expect(runPendingRecommendationCycleNotifications(4)).resolves.toEqual({
      sent: 0, failed: 0, reviewRequired: 0, processed: 4, budgetDeferred: 0,
    })
    expect(seen).toEqual([
      "client-fresh:client_reminder", "staff-fresh:staff_expiry",
      "client-retry:client_reminder", "staff-retry:staff_expiry",
    ])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })

  it("awaits an active claim and stops starting work only after the elapsed budget", async () => {
    let resolveFirst!: (value: unknown) => void
    let clock = 0
    vi.spyOn(Date, "now").mockImplementation(() => clock)
    const first = new Promise<unknown>((resolve) => { resolveFirst = resolve })
    const seen: string[] = []
    fakeQueue([
      [{ cycle_id: "client-fresh", kind: "client_reminder" }],
      [{ cycle_id: "staff-fresh", kind: "staff_expiry" }],
      [{ cycle_id: "client-retry", kind: "client_reminder" }],
      [],
    ], async (id) => {
      seen.push(id)
      return id === "client-fresh" ? first : { status: "suppressed" }
    })
    let settled = false
    const run = runPendingRecommendationCycleNotifications(3, 40_000).then((result) => {
      settled = true
      return result
    })
    await vi.waitFor(() => expect(seen).toEqual(["client-fresh"]))
    expect(settled).toBe(false)
    clock = 40_001
    resolveFirst({ status: "suppressed" })
    await expect(run).resolves.toEqual({
      sent: 0, failed: 0, reviewRequired: 0, processed: 1, budgetDeferred: 2,
    })
    expect(seen).toEqual(["client-fresh"])
    vi.restoreAllMocks()
  })
})
