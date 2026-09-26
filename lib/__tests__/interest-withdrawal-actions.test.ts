import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  verifyStaffPortalSelection: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: mocks.requirePortalAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/staff-portal-selection", () => ({ verifyStaffPortalSelection: mocks.verifyStaffPortalSelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { withdrawMyOpportunityInterest, withdrawStaffPortalOpportunityInterest } from "@/lib/actions/interest-withdrawal"

const target = {
  matchId: "97000000-0000-4000-8000-000000000081",
  opportunityId: "97000000-0000-4000-8000-000000000071",
  interestAt: "2026-09-26T12:00:00.123Z",
  updatedAt: "2026-09-26T12:00:01.000Z",
}
const ownerId = "76000000-0000-4000-8000-000000000004"

describe("confirmed exact-interest withdrawal actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mocks.requirePortalAccess.mockResolvedValue({ repreneurId: ownerId,
      user: { id: "actual-owner", email: "owner@example.test" } })
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "actual-staff", email: "staff@example.test" } })
    mocks.verifyStaffPortalSelection.mockResolvedValue({ workspaceId: "97000000-0000-4000-8000-000000000090",
      generation: "97000000-0000-4000-8000-000000000091" })
    mocks.rpc.mockResolvedValue({ data: { status: "withdrawn", eventId: "event-1" }, error: null })
  })

  it("binds the own exact request and actual authenticated actor", async () => {
    await expect(withdrawMyOpportunityInterest(target.matchId, target.opportunityId,
      target.interestAt, target.updatedAt, "Selected by mistake")).resolves.toMatchObject({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith("w192_withdraw_exact_interest", expect.objectContaining({
      p_match_id: target.matchId, p_opportunity_id: target.opportunityId,
      p_repreneur_id: ownerId, p_actor_id: "actual-owner", p_actor_email: "owner@example.test",
      p_expected_interest_at: target.interestAt, p_expected_updated_at: target.updatedAt,
      p_reason: "Selected by mistake",
    }))
  })

  it("does not call the database for malformed or blank confirmation", async () => {
    await expect(withdrawMyOpportunityInterest("wrong", target.opportunityId,
      target.interestAt, target.updatedAt, "Selected by mistake")).resolves.toMatchObject({ ok: false })
    await expect(withdrawMyOpportunityInterest(target.matchId, target.opportunityId,
      target.interestAt, target.updatedAt, "  ")).resolves.toMatchObject({ ok: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("requires the selected staff workspace and attributes the actual staff user", async () => {
    const staffInput = { selectionToken: "selection-token", repreneurId: ownerId,
      opportunityId: target.opportunityId, matchId: target.matchId,
      expectedInterestAt: target.interestAt, expectedUpdatedAt: target.updatedAt,
      reason: "Repreneur asked staff to withdraw" }
    mocks.verifyStaffPortalSelection.mockResolvedValueOnce(null)
    await expect(withdrawStaffPortalOpportunityInterest(staffInput)).resolves.toMatchObject({ ok: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
    await expect(withdrawStaffPortalOpportunityInterest(staffInput)).resolves.toMatchObject({ ok: true })
    expect(mocks.rpc).toHaveBeenCalledWith("w192_withdraw_exact_interest", expect.objectContaining({
      p_actor_id: "actual-staff", p_actor_email: "staff@example.test",
      p_workspace_id: "97000000-0000-4000-8000-000000000090",
      p_workspace_generation: "97000000-0000-4000-8000-000000000091",
    }))
  })

  it("directs a validation-winning user to staff Drop without claiming withdrawal", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "withdrawal_requires_staff_drop" } })
    await expect(withdrawMyOpportunityInterest(target.matchId, target.opportunityId,
      target.interestAt, target.updatedAt, "Selected by mistake")).resolves.toEqual({
      ok: false, message: "Re-New has already validated this pursuit. Contact the team to use the normal Drop process.",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("pauses new owner and staff withdrawals without touching stored history", async () => {
    vi.stubEnv("INTEREST_WITHDRAWAL_DISABLED", "1")
    await expect(withdrawMyOpportunityInterest(target.matchId, target.opportunityId,
      target.interestAt, target.updatedAt, "Selected by mistake")).resolves.toMatchObject({ ok: false })
    await expect(withdrawStaffPortalOpportunityInterest({
      selectionToken: "selection-token", repreneurId: ownerId,
      opportunityId: target.opportunityId, matchId: target.matchId,
      expectedInterestAt: target.interestAt, expectedUpdatedAt: target.updatedAt,
      reason: "Repreneur asked staff to withdraw",
    })).resolves.toMatchObject({ ok: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
