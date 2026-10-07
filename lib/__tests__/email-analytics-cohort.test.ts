import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc, from: m.from }) }))
import {
  getEmailOperationsAnalytics,
  getEmailHistory,
  getEmailHistoryDetail,
} from "@/lib/actions/email-operations"
beforeEach(() => {
  vi.clearAllMocks()
  m.staff.mockResolvedValue({ user: { id: "fictional-staff" } })
})
describe("staff email operational reads", () => {
  it("distinguishes unavailable and unmeasured from a measured zero", async () => {
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: "Synthetic read error" } })
    expect(await getEmailOperationsAnalytics()).toMatchObject({
      state: "unavailable",
      openRate: null,
      clickRate: null,
    })
    const base = {
      totalSent: 2,
      totalDelivered: 2,
      totalBounced: 1,
      totalOpened: 0,
      totalClicked: 0,
      coveredDelivered: 0,
      uncoveredSent: 2,
      daily: [],
      categories: [{ category: "ma", count: 2 }],
    }
    m.rpc.mockResolvedValueOnce({ data: base, error: null })
    expect(await getEmailOperationsAnalytics(7)).toMatchObject({
      state: "available",
      openRate: null,
      clickRate: null,
      bounceRate: 50,
      days: 7,
    })
    m.rpc.mockResolvedValueOnce({
      data: { ...base, coveredDelivered: 1, uncoveredSent: 1 },
      error: null,
    })
    expect(await getEmailOperationsAnalytics(90)).toMatchObject({
      state: "available",
      openRate: 0,
      clickRate: 0,
      coveredDelivered: 1,
      uncoveredSent: 1,
      days: 90,
      categories: [
        { category: "status", count: 0 },
        { category: "intake", count: 0 },
        { category: "offer", count: 0 },
        { category: "ma", count: 2 },
      ],
    })
  })
  it("denies every operational read before service access for a non-staff role", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(getEmailOperationsAnalytics()).rejects.toThrow("Staff access")
    await expect(getEmailHistory()).rejects.toThrow("Staff access")
    await expect(getEmailHistoryDetail("log:24700000-0000-4000-8000-000000000001")).rejects.toThrow(
      "Staff access",
    )
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.from).not.toHaveBeenCalled()
  })
  it("searches before selecting a bounded page and retains null historic evidence", async () => {
    const operations: string[] = []
    const record = {
      id: "log:24700000-0000-4000-8000-000000000001",
      body_text: null,
      body_html: null,
      sent_at: null,
      provider_message_id: null,
    }
    const query = {
      select: () => query,
      ilike: () => {
        operations.push("search")
        return query
      },
      eq: () => query,
      order: () => query,
      range: async (a: number, b: number) => {
        operations.push(`page:${a}:${b}`)
        return { data: [record], count: 151, error: null }
      },
      maybeSingle: async () => ({ data: record, error: null }),
    }
    m.from.mockReturnValue(query)
    expect(await getEmailHistory({ search: "old recipient", page: 2 })).toMatchObject({
      total: 151,
      records: [record],
    })
    expect(operations).toEqual(["search", "page:25:49"])
    expect(await getEmailHistoryDetail(record.id)).toMatchObject({
      record: { body_text: null, sent_at: null },
      events: [],
    })
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
