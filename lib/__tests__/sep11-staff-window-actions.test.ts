import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }))
import { renewOpportunityRecommendationAction } from "@/lib/actions/renew-opportunity-recommendation"
import { recordBookingRequestSent } from "@/lib/actions/booking-request-reminders"

const id = "71000000-0000-4000-8000-000000000005"
const requestId = "73000000-0000-4000-8000-000000000005"
const initial = { status: "idle", message: "" } as const
function form(matchId = id) { const data = new FormData(); data.set("match_id", matchId); return data }
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"))
  m.staff.mockResolvedValue({ user: { id: "exact-better-auth-staff-id" } })
  m.rpc.mockResolvedValue({ data: { id, sent_at: "2026-09-11T10:00:00Z" }, error: null })
})
afterEach(() => vi.useRealTimers())

describe("staff recommendation renewal boundary", () => {
  it("denies nonstaff before touching persistence", async () => {
    m.staff.mockRejectedValue(new Error("Staff required"))
    await expect(renewOpportunityRecommendationAction(initial, form())).rejects.toThrow("Staff required")
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it("rejects noncanonical identities before RPC", async () => {
    expect((await renewOpportunityRecommendationAction(initial, form("invalid"))).status).toBe("error")
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it("uses the authenticated actor and refreshes staff and portal only on success", async () => {
    expect((await renewOpportunityRecommendationAction(initial, form())).status).toBe("success")
    expect(m.rpc).toHaveBeenCalledWith("renew_opportunity_recommendation", { p_match_id: id, p_actor: "exact-better-auth-staff-id" })
    expect(m.revalidate).toHaveBeenCalledWith("/opportunities", "layout")
    expect(m.revalidate).toHaveBeenCalledWith("/repreneurs", "layout")
    expect(m.revalidate).toHaveBeenCalledWith("/portal/deals")
  })
  it("preserves a denied or failed renewal without success refresh", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "denied" } })
    expect((await renewOpportunityRecommendationAction(initial, form())).status).toBe("error")
    expect(m.revalidate).not.toHaveBeenCalled()
  })
})

describe("staff records an already sent Outlook booking request", () => {
  const input = { repreneurId: id, sentAt: "2026-09-11T10:00:00Z", idempotencyKey: requestId }
  it("keeps caller-stable key and exact staff actor; no provider is involved", async () => {
    const result = await recordBookingRequestSent(input)
    expect(m.rpc).toHaveBeenCalledWith("record_repreneur_booking_request_sent", {
      p_repreneur_id: id, p_sent_at: "2026-09-11T10:00:00.000Z", p_recorded_by: "exact-better-auth-staff-id", p_idempotency_key: requestId,
    })
    expect(result.reminderDueOn).toBe("2026-09-18")
  })
  it.each([{ idempotencyKey: "invalid" }, { repreneurId: "invalid" }, { sentAt: "not-a-date" }, { sentAt: "2999-01-01T00:00:00Z" }])("fails before persistence for invalid input %o", async (change) => {
    await expect(recordBookingRequestSent({ ...input, ...change })).rejects.toThrow()
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it("denies nonstaff and persistence failure without claiming success", async () => {
    m.staff.mockRejectedValueOnce(new Error("Staff required"))
    await expect(recordBookingRequestSent(input)).rejects.toThrow("Staff required")
    expect(m.rpc).not.toHaveBeenCalled()
    m.rpc.mockResolvedValue({ data: null, error: { message: "failure" } })
    await expect(recordBookingRequestSent(input)).rejects.toThrow("Could not record")
    expect(m.revalidate).not.toHaveBeenCalled()
  })
})
