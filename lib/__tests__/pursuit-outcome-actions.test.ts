import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), cleanup: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateRepreneurDashboardTags: vi.fn(), revalidateOpportunityDashboardTags: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }))
vi.mock("@/lib/recipient-im-cleanup", () => ({ processRecipientImCleanup: m.cleanup }))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({ queueM2StaffPursuitEvent: vi.fn() }))
vi.mock("@/lib/actions/staff-email-review", () => ({ preparePursuitEmailReview: vi.fn() }))
vi.mock("@/lib/email/interest-notification-delivery", () => ({ deliverValidationNotification: vi.fn() }))
vi.mock("@/lib/trigger-opportunity-memo-notification", () => ({ triggerOpportunityMemoNotification: vi.fn() }))
vi.mock("@/lib/observability/critical-operation", () => ({ startCriticalOperation: () => ({ failure() {}, success() {}, failOnThrow: (action: () => unknown) => action() }) }))

import { dropOpportunityPursuit } from "@/lib/actions/opportunity-matches"
import { runOpportunityPursuitJourneyAction } from "@/lib/actions/opportunity-pursuit-journey"

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  m.staff.mockResolvedValue({ user: { id: "staff-1", email: "staff@re-new.invalid" } })
  m.rpc.mockResolvedValue({ data: "drop-event", error: null })
  m.cleanup.mockResolvedValue({ deleted: 0, failed: 0, remaining: 0 })
})

describe("staff pursuit outcome commands", () => {
  it("records one main cause and supporting causes through the guarded Drop service", async () => {
    const result = await runOpportunityPursuitJourneyAction({
      matchId: "match-1", action: "drop", reason: "seller_price_expectations_too_high",
      secondaryReasons: ["financing_not_secured"], reasonNote: "  Financing was declined.  ", idempotencyKey: "drop-intent",
    })
    expect(result).toMatchObject({ success: true, eventId: "drop-event" })
    expect(m.rpc).toHaveBeenCalledWith("journey_transition_terminal", {
      p_match_id: "match-1", p_transition: "drop", p_actor: "staff@re-new.invalid", p_idempotency_key: "drop-intent",
      p_closure_reason: "seller_price_expectations_too_high", p_secondary_reasons: ["financing_not_secured"], p_reason_note: "Financing was declined.",
    })
    expect(m.cleanup).toHaveBeenCalledWith({ matchId: "match-1" })
  })

  it("uses the same guarded decision from the Recommendations Drop entry point", async () => {
    expect(await dropOpportunityPursuit("match-1", "opportunity-1", "issues_in_due_diligence", ["other"], "  Specific to this buyer.  ", "recommendation-drop-key")).toEqual({ cleanupPending: false })
    expect(m.rpc).toHaveBeenCalledWith("journey_transition_terminal", {
      p_match_id: "match-1", p_transition: "drop", p_actor: "staff@re-new.invalid", p_idempotency_key: "recommendation-drop-key", p_closure_reason: "issues_in_due_diligence", p_secondary_reasons: ["other"], p_reason_note: "Specific to this buyer.",
    })
    expect(m.cleanup).toHaveBeenCalledWith({ matchId: "match-1" })
  })

  it("denies an incomplete Recommendations Drop before persistence", async () => {
    await expect(dropOpportunityPursuit("match-1", "opportunity-1", "other", [], " ")).rejects.toThrow("Explain Other")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.cleanup).not.toHaveBeenCalled()
  })

  it("denies new Drop writes while the bounded release switch is off", async () => {
    vi.stubEnv("REASONED_LIFECYCLE_WRITES_ENABLED", "false")
    expect(await runOpportunityPursuitJourneyAction({ matchId: "match-1", action: "drop", reason: "financing_not_secured" })).toMatchObject({ success: false })
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.cleanup).not.toHaveBeenCalled()
  })

  it("requires actual staff before recording a Drop", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(runOpportunityPursuitJourneyAction({ matchId: "match-1", action: "drop", reason: "financing_not_secured" })).rejects.toThrow("Staff access required")
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it.each([
    { reason: "other", secondaryReasons: [], reasonNote: "  " },
    { reason: "financing_not_secured", secondaryReasons: ["other"], reasonNote: "" },
    { reason: "reason_not_disclosed", secondaryReasons: ["financing_not_secured"] },
    { reason: "financing_not_secured", secondaryReasons: ["reason_not_disclosed"] },
  ])("rejects an incomplete or contradictory explanation before any outcome write: %j", async (explanation) => {
    const result = await runOpportunityPursuitJourneyAction({ matchId: "match-1", action: "drop", ...explanation })
    expect(result.success).toBe(false)
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.cleanup).not.toHaveBeenCalled()
  })
})
