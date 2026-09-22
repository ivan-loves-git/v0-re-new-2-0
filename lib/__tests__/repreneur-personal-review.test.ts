import { beforeEach, describe, expect, it, vi } from "vitest"
import { partitionPersonalReviews } from "@/lib/utils/repreneur-personal-review"

const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), from: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requirePortalAccess: mocks.access }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
import { recordMyOpportunityViewed, setMyOpportunityReviewed } from "@/lib/actions/repreneur-opportunity-review"
import { readPersonalOpportunityReviews } from "@/lib/data/repreneur-opportunity-review"

const id = "10000000-0000-4000-8000-000000000001"
beforeEach(() => {
  vi.resetAllMocks()
  mocks.access.mockResolvedValue({ role: "repreneur", repreneurId: "owner-from-session" })
  mocks.rpc.mockResolvedValue({ data: [{ viewed: true, reviewed: false }], error: null })
})

describe("personal review server boundary", () => {
  it("derives ownership from the portal session, lets the database derive mode, and sends no browser date", async () => {
    expect(await recordMyOpportunityViewed(id)).toEqual({ ok: true, state: { viewed: true, reviewed: false } })
    expect(mocks.rpc).toHaveBeenCalledWith("record_repreneur_opportunity_review", {
      p_repreneur_id: "owner-from-session", p_opportunity_id: id, p_reviewed: null, p_expected_reviewed: null,
    })
    expect(mocks.revalidate).toHaveBeenCalledWith("/portal/deals", "layout")
  })
  it.each(["staff", "unassigned"])("rejects %s even if supplied a linked profile", async (role) => {
    mocks.access.mockResolvedValue({ role, repreneurId: "somebody" })
    expect((await recordMyOpportunityViewed(id)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("does not persist after access denial or an invalid ID", async () => {
    mocks.access.mockRejectedValueOnce(new Error("redirect"))
    await expect(recordMyOpportunityViewed(id)).rejects.toThrow("redirect")
    expect((await recordMyOpportunityViewed("invalid")).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it("uses an explicit desired value and previous value for cross-session conflict detection", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ reviewed: true }], error: null })
    expect(await setMyOpportunityReviewed(id, true, false)).toEqual({ ok: true, state: { viewed: true, reviewed: true } })
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_reviewed: true, p_expected_reviewed: false })
  })
  it("does not call a failure saved or expose raw provider details", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private provider detail" } })
    const result = await setMyOpportunityReviewed(id, true, false)
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain("private provider")
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it("gives an actionable stale-session conflict", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "review_state_changed" } })
    expect(await setMyOpportunityReviewed(id, false, true)).toEqual({ ok: false, message: expect.stringContaining("another session") })
  })
  it("rejects non-Boolean inputs", async () => {
    expect((await setMyOpportunityReviewed(id, "true" as never, false)).ok).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("personal state reads", () => {
  it("scopes reads to the owner, namespace and visible IDs, returning only Booleans", async () => {
    const eq = vi.fn().mockReturnThis()
    const inIds = vi.fn().mockResolvedValue({ data: [{ opportunity_id: id, reviewed: true }], error: null })
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq, in: inIds }) })
    const result = await readPersonalOpportunityReviews("owner", true, [id])
    expect(eq.mock.calls).toEqual([["repreneur_id", "owner"], ["is_demo", true]])
    expect(inIds).toHaveBeenCalledWith("opportunity_id", [id])
    expect(result?.get(id)).toEqual({ viewed: true, reviewed: true })
  })
  it("uses bounded batches so capped responses cannot invent unviewed state", async () => {
    const inIds = vi.fn().mockResolvedValue({ data: [], error: null })
    const builder = { eq: vi.fn().mockReturnThis(), in: inIds }
    mocks.from.mockReturnValue({ select: () => builder })
    await readPersonalOpportunityReviews("owner", false, Array.from({ length: 203 }, (_, i) => `${i}`))
    expect(inIds.mock.calls.map((args) => args[1].length)).toEqual([100,100,3])
  })
  it("represents unavailable evidence as unknown, not unviewed", async () => {
    mocks.from.mockImplementation(() => { throw new Error("unavailable") })
    expect(await readPersonalOpportunityReviews("owner", false, [id])).toBeNull()
  })
})

describe("review ordering", () => {
  it("partitions stably and keeps Viewed independent from Reviewed", () => {
    const items = [
      { id: "reviewed-a", personal_review: { viewed: true, reviewed: true } },
      { id: "unopened", personal_review: { viewed: false, reviewed: false } },
      { id: "viewed", personal_review: { viewed: true, reviewed: false } },
      { id: "reviewed-b", personal_review: { viewed: true, reviewed: true } },
    ]
    const result = partitionPersonalReviews(items)
    expect([...result.unreviewed, ...result.reviewed].map((item) => item.id)).toEqual(["unopened", "viewed", "reviewed-a", "reviewed-b"])
    expect(items[0].id).toBe("reviewed-a")
    items[0].personal_review.reviewed = false
    expect(partitionPersonalReviews(items).unreviewed.map((item) => item.id)).toEqual(["reviewed-a", "unopened", "viewed"])
  })

  it.each([
    ["mixed known and unavailable", [
      { id: "reviewed", personal_review: { viewed: true, reviewed: true } },
      { id: "unavailable", personal_review: null },
      { id: "unreviewed", personal_review: { viewed: true, reviewed: false } },
    ]],
    ["all unavailable", [
      { id: "first", personal_review: null },
      { id: "second", personal_review: null },
    ]],
  ])("does not classify %s review evidence as unreviewed", (_case, items) => {
    const result = partitionPersonalReviews(items)
    expect(result.available).toBe(false)
    expect(result.unreviewed).toEqual([])
    expect(result.reviewed).toEqual([])
  })
})
