import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateOpportunityDashboardTags: vi.fn() }))

import { closeOpportunity, getOpportunityStaleClosureEligibility, pauseOpportunity } from "@/lib/actions/opportunities"

const eligible = { eligible: true, startedAt: "2026-07-01T00:00:00Z", eligibleAt: "2026-09-29T00:00:00Z", completedDays: 90, basis: "became_active", message: "You can keep this opportunity Active." }

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  m.staff.mockResolvedValue({ user: { id: "staff-1", email: "staff@re-new.invalid" } })
  m.rpc.mockResolvedValue({ data: "lifecycle-event", error: null })
})

describe("staff whole-opportunity lifecycle commands", () => {
  it.each(["paused_cabinet", "seller_paused_sale", "exclusivity_another_buyer", "waiting_updated_information", "other"])("records %s through the whole-sale Pause service", async (reason) => {
    expect(await pauseOpportunity("opportunity-1", reason, "  Sale temporarily suspended.  ")).toMatchObject({ success: true })
    expect(m.rpc).toHaveBeenCalledWith("pause_opportunity_with_reason", { p_opportunity_id: "opportunity-1", p_reason: reason, p_paused_by: "staff-1", p_reason_note: "Sale temporarily suspended." })
  })

  it("requires an explanation for Other before any write", async () => {
    expect(await pauseOpportunity("opportunity-1", "other", "  ")).toMatchObject({ success: false, fieldErrors: { pause_note: expect.any(String) } })
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it.each(["stale", "no_viable_match", "path_stopped_seller_advisor"])("does not use %s as a whole-sale Pause", async (reason) => {
    expect(await pauseOpportunity("opportunity-1", reason)).toMatchObject({ success: false })
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("denies unverified Stale eligibility when the database policy is unavailable", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "Migration not active" } })
    expect(await getOpportunityStaleClosureEligibility("opportunity-1")).toMatchObject({ eligible: false, completedDays: 0 })
    expect(await closeOpportunity("opportunity-1", "stale")).toMatchObject({ success: false })
    expect(m.rpc.mock.calls.every(([name]) => name === "opportunity_stale_closure_eligibility")).toBe(true)
  })

  it("blocks a premature Stale decision without invoking Close", async () => {
    m.rpc.mockResolvedValue({ data: { ...eligible, eligible: false, completedDays: 89 }, error: null })
    expect(await closeOpportunity("opportunity-1", "stale")).toMatchObject({ success: false })
    expect(m.rpc).toHaveBeenCalledTimes(1)
  })

  it("rechecks an eligible manual Stale decision in the guarded Close transaction", async () => {
    m.rpc.mockResolvedValueOnce({ data: eligible, error: null }).mockResolvedValueOnce({ data: "closure-event", error: null })
    expect(await closeOpportunity("opportunity-1", "stale")).toMatchObject({ success: true })
    expect(m.rpc).toHaveBeenLastCalledWith("close_opportunity_with_reason", { p_opportunity_id: "opportunity-1", p_reason: "stale", p_closed_by: "staff-1" })
  })

  it("reports a pursuit activation between the displayed eligibility and Close", async () => {
    m.rpc.mockResolvedValueOnce({ data: eligible, error: null }).mockResolvedValueOnce({ data: null, error: { message: "opportunity_stale_not_eligible" } })
    expect(await closeOpportunity("opportunity-1", "stale")).toMatchObject({ success: false, fieldErrors: { closure_reason: expect.any(String) } })
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it("keeps the existing permanent Close choices independent from the Stale clock", async () => {
    expect(await closeOpportunity("opportunity-1", "sold")).toMatchObject({ success: true })
    expect(m.rpc).toHaveBeenCalledTimes(1)
    expect(m.rpc).toHaveBeenCalledWith("close_opportunity_with_reason", expect.objectContaining({ p_reason: "sold" }))
  })

  it("supports a bounded write stop while preserving other Close choices and reads", async () => {
    vi.stubEnv("REASONED_LIFECYCLE_WRITES_ENABLED", "false")
    expect(await pauseOpportunity("opportunity-1", "paused_cabinet")).toMatchObject({ success: false })
    expect(await closeOpportunity("opportunity-1", "stale")).toMatchObject({ success: false })
    expect(m.rpc).not.toHaveBeenCalled()
    expect(await closeOpportunity("opportunity-1", "sold")).toMatchObject({ success: true })
    m.rpc.mockResolvedValue({ data: eligible, error: null })
    expect(await getOpportunityStaleClosureEligibility("opportunity-1")).toMatchObject({ eligible: true })
  })

  it.each([() => pauseOpportunity("opportunity-1", "paused_cabinet"), () => closeOpportunity("opportunity-1", "stale"), () => getOpportunityStaleClosureEligibility("opportunity-1")])("requires staff before reading or changing lifecycle", async (command) => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(command()).rejects.toThrow("Staff access required")
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
