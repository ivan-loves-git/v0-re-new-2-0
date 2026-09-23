import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { recordStaffPortalOpportunityResponse } from "@/lib/actions/staff-portal-assistance"

const input = {
  repreneurId: "10000000-0000-4000-8000-000000000001",
  opportunityId: "10000000-0000-4000-8000-000000000002",
  matchId: "10000000-0000-4000-8000-000000000003",
  expectedOpportunityUpdatedAt: "2026-09-23T12:00:00Z",
  expectedMatchUpdatedAt: "2026-09-23T12:00:00Z",
  expectedInterestAt: null,
  response: "interested" as const,
  declineReasonCategories: [],
  declineReasonText: null,
  operationKey: "10000000-0000-4000-8000-000000000004",
}

describe("staff Portal opportunity action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "actual-staff", email: "staff@example.test" } })
    mocks.rpc.mockResolvedValue({ data: { eventId: "event-1" }, error: null })
  })

  it("uses only the real staff actor and exact selected objects; sends no owner notification", async () => {
    await recordStaffPortalOpportunityResponse(input)
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("w196_record_staff_opportunity_response", expect.objectContaining({
      p_repreneur_id: input.repreneurId,
      p_opportunity_id: input.opportunityId,
      p_match_id: input.matchId,
      p_staff_user_id: "actual-staff",
      p_staff_email: "staff@example.test",
      p_operation_key: input.operationKey,
    }))
  })

  it("rejects malformed/stale submissions before the database write", async () => {
    await expect(recordStaffPortalOpportunityResponse({ ...input, opportunityId: "other" })).rejects.toThrow("invalid")
    await expect(recordStaffPortalOpportunityResponse({ ...input, response: "declined", declineReasonCategories: [], declineReasonText: null })).rejects.toThrow("reason")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
