import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmailDirect: vi.fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/email/send-email", () => ({ sendEmailDirect: mocks.sendEmailDirect }))
vi.mock("@/lib/env", () => ({ env: { RENEW_STAFF_NOTIFICATION_EMAIL: "staff@example.test" } }))

import { sendLockedOpportunityInterestEmail } from "@/lib/email/locked-opportunity-interest"

const input = {
  matchId: "97000000-0000-4000-8000-000000000081",
  expressedAt: "2026-09-26T12:00:00.123Z",
  idempotencyKey: "locked-interest-exact-token",
  repreneurId: "97000000-0000-4000-8000-000000000004",
  repreneurName: "Synthetic Person",
  repreneurEmail: "synthetic@example.test",
  opportunityId: "97000000-0000-4000-8000-000000000071",
  opportunityReference: "SYNTHETIC",
  opportunityTitle: "Synthetic opportunity",
  hasOtherActivePursuit: false,
}

function setup(initialStatus: string | null, begin: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: initialStatus ? { status: initialStatus } : null, error: null })
  const query = { eq: vi.fn().mockReturnThis(), maybeSingle }
  const from = vi.fn(() => ({ select: vi.fn(() => query) }))
  const rpc = vi.fn(async (name: string) => {
    if (name === "w192_begin_direct_interest_notice") return { data: begin, error: null }
    if (name === "w192_complete_direct_interest_notice") return { data: "sent", error: null }
    throw new Error(`Unexpected RPC ${name}`)
  })
  mocks.createAdminClient.mockReturnValue({ from, rpc })
  return { from, rpc, maybeSingle }
}

describe("direct locked-interest staff notice", () => {
  beforeEach(() => vi.clearAllMocks())

  it("checks the exact current token at the provider boundary and records a sent receipt", async () => {
    const { rpc } = setup(null, true)
    mocks.sendEmailDirect.mockImplementation(async ({ beforeProviderAttempt }) => {
      expect(await beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "synthetic-receipt", providerOutcome: "accepted" }
    })
    await expect(sendLockedOpportunityInterestEmail(input)).resolves.toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith("w192_begin_direct_interest_notice", {
      p_match_id: input.matchId, p_interest_at: input.expressedAt,
    })
    expect(rpc).toHaveBeenCalledWith("w192_complete_direct_interest_notice", expect.objectContaining({
      p_match_id: input.matchId, p_interest_at: input.expressedAt,
      p_outcome: "sent", p_provider_message_id: "synthetic-receipt",
    }))
  })

  it("cannot send after withdrawal wins the exact-token provider fence", async () => {
    const { rpc } = setup("suppressed", false)
    mocks.sendEmailDirect.mockImplementation(async ({ beforeProviderAttempt }) => {
      expect(await beforeProviderAttempt()).toBe(false)
      return { success: false, providerOutcome: "fenced" }
    })
    await expect(sendLockedOpportunityInterestEmail(input)).resolves.toMatchObject({ success: false })
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w192_complete_direct_interest_notice")
  })

  it("rejoins a confirmed sent exact-token receipt without another provider call", async () => {
    setup("sent", false)
    await expect(sendLockedOpportunityInterestEmail(input)).resolves.toMatchObject({ success: true })
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })
})
