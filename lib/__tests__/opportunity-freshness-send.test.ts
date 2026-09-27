import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

const m = vi.hoisted(() => ({ rpc: vi.fn(), version: vi.fn(), build: vi.fn(), send: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }))
vi.mock("@/lib/ma-workflows", () => ({
  getMaReviewTemplateVersion: m.version, buildMaReviewedRequest: m.build,
}))
vi.mock("@/lib/email/resend-client", () => ({ resend: { emails: { send: m.send } } }))

import { sendOpportunityFreshnessReview } from "@/lib/opportunity-freshness-send"

const review = {
  id: "18700000-0000-4000-8000-000000000001", source_kind: "freshness", version: 3,
  namespace: "REAL", template_version: "copy-v1", state: "pending",
  subject: "Current group", body_text: "A-01 and B-02", recipient_email: "source@example.test",
} as StaffEmailReview

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPPORTUNITY_FRESHNESS_DISPATCH_ENABLED
  m.version.mockResolvedValue("copy-v1")
  m.build.mockReturnValue({ from: "Re-New <noreply@example.test>", to: ["source@example.test"], subject: review.subject, html: "<p>A-01 and B-02</p>", text: review.body_text })
  m.rpc.mockImplementation(async (name) => ({ data: name === "opportunity_freshness_reserve" ? "18700000-0000-4000-8000-000000000002" : null, error: null }))
  m.send.mockResolvedValue({ data: { id: "provider-accepted-group" }, error: null })
})

describe("grouped staff-reviewed provider boundary", () => {
  it("uses one provider key and records one accepted receipt for the frozen group", async () => {
    const result = await sendOpportunityFreshnessReview(review, 3, "staff-1")
    expect(result.state).toBe("sent")
    expect(m.send).toHaveBeenCalledTimes(1)
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: ["source@example.test"], text: "A-01 and B-02" }), { idempotencyKey: review.id })
    expect(m.rpc).toHaveBeenCalledWith("opportunity_freshness_finish", expect.objectContaining({ p_review_id: review.id, p_state: "sent", p_provider_message_id: "provider-accepted-group" }))
  })

  it("vetoes all provider I/O when any member drifts after reservation", async () => {
    m.rpc.mockImplementation(async (name) => ({ data: name === "opportunity_freshness_reserve" ? "18700000-0000-4000-8000-000000000002" : null,
      error: name === "opportunity_freshness_assert_current" ? { message: "member changed" } : null }))
    const result = await sendOpportunityFreshnessReview(review, 3, "staff-1")
    expect(result.state).toBe("failed")
    expect(m.send).not.toHaveBeenCalled()
  })

  it("preserves uncertainty when a retry encounters a provider rejection", async () => {
    m.send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Rejected" } })
    const result = await sendOpportunityFreshnessReview({ ...review, state: "uncertain" }, 3, "staff-2")
    expect(result.state).toBe("uncertain")
    expect(m.rpc).toHaveBeenCalledWith("opportunity_freshness_finish", expect.objectContaining({ p_state: "uncertain", p_provider_message_id: null }))
  })

  it("blocks disabled templates and rollback switches before reservation or provider I/O", async () => {
    m.version.mockRejectedValue(new Error("Template disabled"))
    await expect(sendOpportunityFreshnessReview(review, 3, "staff-1")).rejects.toThrow("disabled")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
    m.version.mockResolvedValue("copy-v1")
    process.env.OPPORTUNITY_FRESHNESS_DISPATCH_ENABLED = "false"
    await expect(sendOpportunityFreshnessReview(review, 3, "staff-1")).rejects.toThrow("temporarily disabled")
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
