import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ staff: vi.fn(), prepare: vi.fn(), begin: vi.fn(), finalize: vi.fn(), current: vi.fn(), mail: vi.fn(), resend: vi.fn(), suppression: vi.fn(), recipient: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.recipient }) }) }) }) }))
vi.mock("@/lib/ma-workflows", () => ({ sendMaSourceWorkflowEmailPayload: m.mail }))
vi.mock("@/lib/pursuit-handoff-delivery", () => ({ preparePursuitHandoff: m.prepare, beginPursuitHandoff: m.begin, finalizePursuitHandoff: m.finalize, assertPursuitHandoffCurrent: m.current }))
vi.mock("@/lib/email/resend-client", () => ({ FROM_NAME: "Configured Re-New", FROM_EMAIL: "configured@re-new.invalid", resend: { emails: { send: m.resend } } }))
vi.mock("@/lib/email/ma-contact-email-authorization", () => ({ isMaContactEmailAddressSuppressed: m.suppression }))
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://app.re-new.team" } }))

import { sendPursuitIntermediaryHandoff, sendPursuitNdaReadyNotice } from "@/lib/actions/opportunity-pursuit-handoffs"

function prepared(blank = false) {
  return { handoff: { matchId: "match", opportunityId: "opp", upstreamId: "validation", type: "e4", snapshot: [] }, context: { upstream: { metadata: { blank_nda_present_at_validation: blank } }, repreneur: { id: "buyer", email: "buyer@re-new.invalid", first_name: "Buyer" } } }
}
beforeEach(() => {
  vi.clearAllMocks()
  m.staff.mockResolvedValue({ user: { id: "staff-id", email: "staff@re-new.invalid" } })
  m.prepare.mockResolvedValue(prepared())
  m.begin.mockResolvedValue({ delivery_id: "delivery", operation_key: "same-operation", delivery_status: "sending", evidence_id: null })
  m.finalize.mockResolvedValue("evidence")
  m.current.mockResolvedValue(undefined)
  m.mail.mockResolvedValue({ success: true, eventId: "evidence", message: "sent" })
  m.suppression.mockResolvedValue(false)
  m.recipient.mockResolvedValue({ data: { email: "buyer@re-new.invalid" }, error: null })
  m.resend.mockResolvedValue({ data: { id: "accepted" }, error: null })
})

describe("canonical pursuit handoff actions", () => {
  it("denies unauthenticated staff before preparing or sending", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(sendPursuitIntermediaryHandoff("match", "e4")).rejects.toThrow("Staff access")
    expect(m.prepare).not.toHaveBeenCalled()
    expect(m.mail).not.toHaveBeenCalled()
  })
  it.each([true, false])("E4 uses NDA presence frozen at validation (%s)", async (present) => {
    m.prepare.mockResolvedValue(prepared(present))
    expect((await sendPursuitIntermediaryHandoff("match", "e4")).success).toBe(true)
    const [, payload, descriptor] = m.mail.mock.calls[0]
    expect(payload.body.includes("modèle de NDA")).toBe(!present)
    expect(payload.clientOperationKey).toBe("validation")
    expect(descriptor.upstreamId).toBe("validation")
  })
  it("does not replay historical E4 without the frozen request fact", async () => {
    const p = prepared(); p.context.upstream.metadata = {} as typeof p.context.upstream.metadata
    m.prepare.mockResolvedValue(p)
    expect((await sendPursuitIntermediaryHandoff("match", "e4")).success).toBe(false)
    expect(m.mail).not.toHaveBeenCalled()
  })
  it.each(["sent", "in_flight"])("does not send E6 again while %s", async (status) => {
    m.begin.mockResolvedValue({ delivery_id: "delivery", operation_key: "same-operation", delivery_status: status, evidence_id: status === "sent" ? "evidence" : null })
    const result = await sendPursuitNdaReadyNotice("match")
    expect(result.success).toBe(status === "sent")
    expect(m.resend).not.toHaveBeenCalled()
  })
  it("sends E6 to the exact repreneur with configured sender and no source details", async () => {
    expect((await sendPursuitNdaReadyNotice("match")).success).toBe(true)
    const [request, options] = m.resend.mock.calls[0]
    expect(request.from).toBe("Configured Re-New <configured@re-new.invalid>")
    expect(request.to).toEqual(["buyer@re-new.invalid"])
    expect(request.text).toContain("https://app.re-new.team/portal/deals/match")
    expect(Object.keys(request).sort()).toEqual(["from", "html", "subject", "text", "to"])
    expect(options).toEqual({ idempotencyKey: "same-operation" })
    expect(m.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation_key: "same-operation" }), "staff@re-new.invalid", "sent", "accepted", null)
  })
  it.each(["provider", "transport"])("preserves an uncertain E6 operation after %s failure", async (mode) => {
    if (mode === "provider") m.resend.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", message: "retry" } })
    else m.resend.mockRejectedValue(new Error("transport"))
    const result = await sendPursuitNdaReadyNotice("match")
    expect(result.success).toBe(false)
    expect(result.message).toContain("uncertain")
    expect(m.finalize).not.toHaveBeenCalled()
  })
  it("records a conclusive rejection before offering an explicit retry", async () => {
    m.resend.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Rejected sender" } })
    const result = await sendPursuitNdaReadyNotice("match")
    expect(result.success).toBe(false)
    expect(m.finalize).toHaveBeenCalledWith(expect.anything(), expect.anything(), "staff@re-new.invalid", "failed", null, "Rejected sender")
  })
  it("does not send after recipient drift or suppression", async () => {
    m.recipient.mockResolvedValue({ data: { email: "different@re-new.invalid" }, error: null })
    expect((await sendPursuitNdaReadyNotice("match")).success).toBe(false)
    expect(m.resend).not.toHaveBeenCalled()
    m.suppression.mockResolvedValue(true)
    expect((await sendPursuitNdaReadyNotice("match")).success).toBe(false)
    expect(m.resend).not.toHaveBeenCalled()
  })
  it("keeps accepted-but-unfinalized E6 visibly pending", async () => {
    m.finalize.mockRejectedValue(new Error("database unavailable"))
    const result = await sendPursuitNdaReadyNotice("match")
    expect(result.success).toBe(false)
    expect(result.message).toContain("reconcile")
    expect(m.resend).toHaveBeenCalledOnce()
  })
})
