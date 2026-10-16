import { beforeEach, describe, expect, it, vi } from "vitest"
const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }))
import { createOpportunityMemoNotificationStore } from "@/lib/data/opportunity-memo-notification"
const claim = { opportunityId: "opportunity", matchId: "match", expectedGrantId: "grant-B", attemptedAt: "2026-10-07T12:00:00Z" }
beforeEach(() => vi.clearAllMocks())
describe("versioned memo notice persistence", () => {
  it("carries the expected grant and returns exact identity/token without attributing legacy receipts", async () => {
    rpc.mockResolvedValue({ data: [{ match_id: "match", opportunity_id: "opportunity", repreneur_id: "owner", recipient_email: "synthetic@example.invalid", repreneur_first_name: "Synthetic", opportunity_title: "Synthetic", grant_evidence_id: "grant-B", attempt_token: "token-B" }], error: null })
    expect(await createOpportunityMemoNotificationStore().claim(claim)).toMatchObject({ grantEvidenceId: "grant-B", attemptToken: "token-B" })
    expect(rpc).toHaveBeenCalledWith("claim_opportunity_memo_grant_notice", expect.objectContaining({ p_expected_grant_id: "grant-B" }))
  })
  it("does not fall back after a stale/unclaimable grant or a real persistence error", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await createOpportunityMemoNotificationStore().claim(claim)).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "stale" } })
    await expect(createOpportunityMemoNotificationStore().claim(claim)).rejects.toThrow("stale")
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it("supports code-before-schema only on an actually missing RPC", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "missing function" } }).mockResolvedValueOnce({ data: [], error: null })
    expect(await createOpportunityMemoNotificationStore().claim(claim)).toBeNull()
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["claim_opportunity_memo_grant_notice", "claim_opportunity_memo_notification"])
  })
  it("finalizes B with B's token and never calls the match-scoped legacy finalizer", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await createOpportunityMemoNotificationStore().markSent({ matchId: "match", grantEvidenceId: "grant-B", attemptToken: "token-B", sentAt: claim.attemptedAt, providerId: "synthetic-accepted" })
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith("finish_opportunity_memo_grant_notice", expect.objectContaining({ p_grant_id: "grant-B", p_token: "token-B", p_provider_id: "synthetic-accepted" }))
  })
})
