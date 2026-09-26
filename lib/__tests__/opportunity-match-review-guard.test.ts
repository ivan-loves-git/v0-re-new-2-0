import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
}))

import { markOpportunityMatchReviewed } from "@/lib/actions/opportunity-matches"

const matchId = "97000000-0000-4000-8000-000000000081"
const opportunityId = "97000000-0000-4000-8000-000000000071"

describe("staff response review is limited to still-actionable responses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
  })

  it("guards a stale Mark reviewed submission against Withdrawn and wrong-opportunity rows", async () => {
    const query = {
      update: vi.fn(), eq: vi.fn(), in: vi.fn(), is: vi.fn(),
      select: vi.fn(), maybeSingle: vi.fn(),
    }
    query.update.mockReturnValue(query)
    query.eq.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.is.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) })

    await markOpportunityMatchReviewed(matchId, opportunityId)

    expect(query.eq).toHaveBeenCalledWith("id", matchId)
    expect(query.eq).toHaveBeenCalledWith("opportunity_id", opportunityId)
    expect(query.in).toHaveBeenCalledWith("status", ["interested", "declined"])
    expect(query.is).toHaveBeenCalledWith("reviewed_at", null)
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ reviewed_by: "staff-1" }))
  })
})
