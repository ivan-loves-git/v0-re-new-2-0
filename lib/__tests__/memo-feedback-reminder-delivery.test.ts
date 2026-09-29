import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), sendEmail: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/email/send-email", () => ({ sendEmail: mocks.sendEmail }))

import { deliverMemoFeedbackReminder, memoFeedbackReminderKey, renderMemoFeedbackCopy, runPendingMemoFeedbackReminders } from "@/lib/email/memo-feedback-reminder-delivery"

const grantId = "74000000-0000-4000-8000-000000000101"
const leaseToken = "74000000-0000-4000-8000-000000000102"
const payload = {
  grantEvidenceId: grantId,
  matchId: "74000000-0000-4000-8000-000000000103",
  repreneurId: "74000000-0000-4000-8000-000000000104",
  recipientEmail: "buyer@example.test",
  firstName: "Sophie",
  opportunityTitle: "Synthetic public title",
  templateKey: "memo_feedback_reminder" as const,
  subject: "Retour sur {opportunityTitle}",
  body: "Bonjour {firstName}, merci pour votre retour sur {opportunityTitle}.",
}

function fakeDelivery(options?: { claimStatus?: string; payload?: unknown; payloadError?: boolean; completeResult?: string }) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "w174_claim_memo_feedback_reminder") return { data: options?.claimStatus
      ? { status: options.claimStatus } : { status: "claimed", leaseToken }, error: null }
    if (name === "w174_memo_feedback_delivery_payload") return {
      data: options?.payload === undefined ? payload : options.payload,
      error: options?.payloadError ? { message: "synthetic DB error" } : null,
    }
    if (name === "w174_begin_memo_feedback_provider_attempt") return { data: true, error: null }
    if (name === "w174_complete_memo_feedback_reminder") return { data: options?.completeResult ?? "suppressed", error: null }
    throw new Error(`Unexpected RPC ${name}`)
  })
  const maybeSingle = vi.fn().mockResolvedValue({ data: { provider_outcome: "rejected" }, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn().mockReturnValue({ select }) })
  return rpc
}

function fakeQueue(pending: string[], failed: string[], claim: (grant: string) => Promise<unknown>) {
  const queue = (data: string[]) => {
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), lte: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({ data: data.map((grant_evidence_id) => ({ grant_evidence_id })), error: null })),
    }
    return query
  }
  const review = {
    select: vi.fn(() => review),
    eq: vi.fn(async () => ({ count: 0, error: null })),
  }
  const from = vi.fn()
    .mockReturnValueOnce(queue(pending))
    .mockReturnValueOnce(queue(failed))
    .mockReturnValueOnce(review)
  const rpc = vi.fn(async (name: string, args: { p_grant_evidence_id: string }) => {
    if (name !== "w174_claim_memo_feedback_reminder") throw new Error(`Unexpected RPC ${name}`)
    return { data: await claim(args.p_grant_evidence_id), error: null }
  })
  mocks.createAdminClient.mockReturnValue({ from, rpc })
  return { from, rpc }
}

describe("exact-grant memo feedback delivery", () => {
  beforeEach(() => vi.clearAllMocks())

  it("never revives an inactive-at-grant reminder", async () => {
    const rpc = fakeDelivery({ claimStatus: "suppressed" })
    await expect(deliverMemoFeedbackReminder(grantId)).resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("uses an immutable exact-grant provider key and checks the current payload at provider boundary", async () => {
    const rpc = fakeDelivery({ completeResult: "sent" })
    mocks.sendEmail.mockImplementation(async ({ to, idempotencyKey, beforeProviderAttempt }) => {
      expect(to).toBe("buyer@example.test")
      expect(idempotencyKey).toBe(memoFeedbackReminderKey(grantId))
      expect(await beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "provider-174", providerOutcome: "accepted" }
    })
    await expect(deliverMemoFeedbackReminder(grantId)).resolves.toBe("sent")
    expect(rpc).toHaveBeenCalledWith("w174_begin_memo_feedback_provider_attempt", expect.objectContaining({
      p_grant_evidence_id: grantId, p_expected_payload: payload,
    }))
  })

  it("maps a pre-provider recipient block to terminal suppression with zero provider calls", async () => {
    const rpc = fakeDelivery()
    mocks.sendEmail.mockResolvedValue({ success: false, providerOutcome: "blocked" })
    await expect(deliverMemoFeedbackReminder(grantId)).resolves.toBe("suppressed")
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w174_begin_memo_feedback_provider_attempt")
    expect(rpc).toHaveBeenCalledWith("w174_complete_memo_feedback_reminder", expect.objectContaining({
      p_outcome: "suppressed",
    }))
  })

  it("surfaces canonical review-required after an earlier unknown attempt meets a block", async () => {
    fakeDelivery({ completeResult: "review_required" })
    mocks.sendEmail.mockResolvedValue({ success: false, providerOutcome: "blocked" })
    await expect(deliverMemoFeedbackReminder(grantId)).resolves.toBe("review_required")
  })

  it("does not suppress committed intent on a transient payload read error", async () => {
    const rpc = fakeDelivery({ payloadError: true })
    await expect(deliverMemoFeedbackReminder(grantId)).resolves.toBe("failed")
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w174_complete_memo_feedback_reminder")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("never interpolates source, IM, or private staff notes into a client reminder", () => {
    const copy = renderMemoFeedbackCopy({
      ...payload, body: "{firstName} {sourceOffice} {informationMemo} {staffNotes}",
    })
    expect(copy.body).toContain("{sourceOffice}")
    expect(copy.body).toContain("{informationMemo}")
    expect(copy.body).toContain("{staffNotes}")
    expect(JSON.stringify(copy.variables)).not.toContain("sourceOffice")
  })

  it("interleaves fresh and rotated failed grants within the small daily batch", async () => {
    const seen: string[] = []
    fakeQueue(["fresh-a", "fresh-b"], ["retry-a", "retry-b"], async (id) => {
      seen.push(id)
      return { status: "suppressed" }
    })
    await expect(runPendingMemoFeedbackReminders(4)).resolves.toEqual({
      sent: 0, failed: 0, reviewRequired: 0, processed: 4, budgetDeferred: 0,
    })
    expect(seen).toEqual(["fresh-a", "retry-a", "fresh-b", "retry-b"])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("fully awaits an active claim and stops starting new work after the elapsed budget", async () => {
    let resolveFirst!: (value: unknown) => void
    let clock = 0
    vi.spyOn(Date, "now").mockImplementation(() => clock)
    const first = new Promise<unknown>((resolve) => { resolveFirst = resolve })
    const seen: string[] = []
    fakeQueue(["fresh-a", "fresh-b"], ["retry-a"], async (id) => {
      seen.push(id)
      return id === "fresh-a" ? first : { status: "suppressed" }
    })
    let settled = false
    const run = runPendingMemoFeedbackReminders(3, 40_000).then((result) => {
      settled = true
      return result
    })
    await vi.waitFor(() => expect(seen).toEqual(["fresh-a"]))
    expect(settled).toBe(false)
    clock = 40_001
    resolveFirst({ status: "suppressed" })
    await expect(run).resolves.toEqual({
      sent: 0, failed: 0, reviewRequired: 0, processed: 1, budgetDeferred: 2,
    })
    expect(seen).toEqual(["fresh-a"])
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
