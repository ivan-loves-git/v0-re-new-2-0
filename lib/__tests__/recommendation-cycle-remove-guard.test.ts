import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(), createAdminClient: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { removeOpportunityMatch } from "@/lib/actions/opportunity-matches"

const matchId = "75000000-0000-4000-8000-000000000201"
const opportunityId = "75000000-0000-4000-8000-000000000202"

function fakeDelete(error: { code: string; message: string } | null) {
  const matchQuery = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  }
  matchQuery.select.mockReturnValue(matchQuery)
  matchQuery.eq.mockReturnValue(matchQuery)
  matchQuery.maybeSingle.mockResolvedValue({ data: { id: matchId, status: "proposed" }, error: null })
  const finalQuery = { eq: vi.fn().mockResolvedValue({ error }) }
  const deleteQuery = {
    delete: vi.fn(), eq: vi.fn().mockReturnValue(finalQuery),
  }
  deleteQuery.delete.mockReturnValue(deleteQuery)
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValueOnce(matchQuery).mockReturnValueOnce(deleteQuery),
  })
}

describe("recommendation removal while delivery state is unresolved", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff" })
  })

  it("gives a short wait instruction for a live provider request", async () => {
    fakeDelete({ code: "P0001", message: "recommendation_cycle_delivery_in_flight" })
    await expect(removeOpportunityMatch(matchId, opportunityId)).resolves.toEqual({
      ok: false,
      message: "A recommendation email is being delivered. Wait for it to finish, then try again.",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("requires an operations review for unknown acceptance, not an immediate retry", async () => {
    fakeDelete({ code: "P0001", message: "recommendation_cycle_delivery_review_required" })
    await expect(removeOpportunityMatch(matchId, opportunityId)).resolves.toEqual({
      ok: false,
      message: "A recommendation email has an unresolved delivery outcome. Ask operations to review it before removing this match.",
    })
  })

  it("never exposes an unexpected database error", async () => {
    fakeDelete({ code: "XX000", message: "private recipient and source payload" })
    const result = await removeOpportunityMatch(matchId, opportunityId)
    expect(result).toEqual({ ok: false, message: "Recommendation removal failed. Try again." })
    expect(JSON.stringify(result)).not.toContain("private")
  })

  it("preserves ordinary supported delete behavior", async () => {
    fakeDelete(null)
    await expect(removeOpportunityMatch(matchId, opportunityId)).resolves.toEqual({ ok: true })
    expect(mocks.revalidatePath).toHaveBeenCalledOnce()
  })
})
