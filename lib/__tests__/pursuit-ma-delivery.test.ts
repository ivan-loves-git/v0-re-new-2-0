import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), from: vi.fn(), send: vi.fn(), authorize: vi.fn(), begin: vi.fn(), finalize: vi.fn(), current: vi.fn(), order: [] as string[] }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc, from: m.from }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateOpportunityDashboardTags: vi.fn() }))
vi.mock("@/lib/email/resend-client", () => ({ FROM_NAME: "Re-New", FROM_EMAIL: "test@re-new.invalid", resend: { emails: { send: m.send } } }))
vi.mock("@/lib/email/ma-contact-email-authorization", () => ({ authorizeMaContactEmailSend: m.authorize }))
vi.mock("@/lib/pursuit-handoff-delivery", () => ({ beginPursuitHandoff: m.begin, finalizePursuitHandoff: m.finalize, assertPursuitHandoffCurrent: m.current }))
vi.mock("@/lib/observability/critical-operation", () => ({ startCriticalOperation: () => ({ success: vi.fn(), failure: vi.fn() }) }))

import { sendMaSourceWorkflowEmailPayload } from "@/lib/ma-workflows"
import type { PreparedPursuitHandoff } from "@/lib/pursuit-handoff-delivery"

const upstream = "11200000-0000-4000-8000-000000000004"
const operation = "11200000-0000-4000-8000-000000000005"
const payload = { templateKey: "ma_nda_info_memo_request", subject: "NDA {{opportunityTitle}}", body: "Two exact signed copies", clientOperationKey: upstream }
const handoff: PreparedPursuitHandoff = { type: "e7", matchId: "match", opportunityId: "opp", upstreamId: upstream, snapshot: [], attachments: [{ filename: "renew.pdf", content: Buffer.from("%PDF-renew"), contentType: "application/pdf" }, { filename: "buyer.pdf", content: Buffer.from("%PDF-buyer"), contentType: "application/pdf" }] }
const opportunity = { id: "opp", is_demo: false, reference: "QA", public_title: "Safe title", source_office_id: "office", source_office: { id: "office", name: "Office", firm: { name: "Source" } }, office_contacts: [{ id: "link", affiliation_id: "affiliation", is_active: true, is_primary: true, affiliation: { contact: { id: "contact", display_name: "Contact", email: "contact@re-new.invalid" } } }] }
function query(result: unknown) {
  const q = { select: () => q, eq: () => q, single: () => Promise.resolve({ data: result, error: null }), order: () => Promise.resolve({ data: result, error: null }) }
  return q
}
beforeEach(() => {
  vi.clearAllMocks(); m.order.length = 0
  m.staff.mockResolvedValue({ user: { id: "staff-id", email: "staff@re-new.invalid" } })
  m.from.mockImplementation((table) => query(table === "opportunities" ? opportunity : [{ id: "match", status: "active_pursuit", repreneur: { is_demo: false, first_name: "Buyer" } }]))
  m.authorize.mockResolvedValue({ allowed: true })
  m.begin.mockImplementation(async () => { m.order.push("handoff reserved"); return { delivery_id: "delivery", operation_key: operation, delivery_status: "sending", evidence_id: null } })
  m.current.mockImplementation(async () => { m.order.push("current gate checked") })
  m.finalize.mockImplementation(async () => { m.order.push("handoff finalized"); return "evidence" })
  m.rpc.mockImplementation(async (name) => {
    m.order.push(name)
    if (name === "ma_opportunity_source_review_required") return { data: false, error: null }
    if (name === "reserve_ma_source_email_send") return { data: "reservation", error: null }
    if (name === "begin_ma_interaction_email_send") return { data: [{ interaction_id: "interaction", provider_idempotency_key: "provider-key", delivery_status: "pending" }], error: null }
    return { data: true, error: null }
  })
  m.send.mockImplementation(async () => { m.order.push("provider"); return { data: { id: "receipt" }, error: null } })
})
describe("E4/E7 canonical M&A delivery", () => {
  it("freezes the handoff before sending exact bytes, then binds canonical receipt before progression", async () => {
    const result = await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)
    expect(result).toMatchObject({ success: true, eventId: "evidence" })
    expect(m.order.indexOf("handoff reserved")).toBeLessThan(m.order.indexOf("provider"))
    expect(m.order.indexOf("current gate checked")).toBeLessThan(m.order.indexOf("provider"))
    expect(m.order.indexOf("finalize_ma_interaction_email_send")).toBeLessThan(m.order.indexOf("handoff finalized"))
    expect(m.rpc).toHaveBeenCalledWith("begin_ma_interaction_email_send", expect.objectContaining({ p_client_operation_key: operation }))
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: ["contact@re-new.invalid"], attachments: handoff.attachments }), { idempotencyKey: "provider-key" })
    expect(m.finalize).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation_key: operation }), "staff@re-new.invalid", "sent", "receipt", null, "interaction")
  })
  it("does not call the provider while the handoff lease is in flight", async () => {
    m.begin.mockResolvedValue({ delivery_id: "delivery", operation_key: operation, delivery_status: "in_flight" })
    expect((await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)).success).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("retains the same operation after ambiguous transport and does not finalize failed", async () => {
    m.send.mockRejectedValue(new Error("timeout"))
    expect(await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)).toMatchObject({ success: false, operationState: "pending" })
    expect(m.finalize).not.toHaveBeenCalled()
    expect(m.rpc.mock.calls.filter(([name]) => name === "finalize_ma_interaction_email_send")).toHaveLength(0)
  })
  it("records an actual canonical rejection before the handoff becomes retryable", async () => {
    m.send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "sender rejected" } })
    expect(await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)).toMatchObject({ success: false, operationState: "failed" })
    expect(m.finalize).toHaveBeenCalledWith(expect.anything(), expect.anything(), "staff@re-new.invalid", "failed", null, "sender rejected", "interaction")
  })
  it("blocks provider I/O when the gate becomes stale", async () => {
    m.current.mockRejectedValue(new Error("Gate changed"))
    expect((await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)).success).toBe(false)
    expect(m.send).not.toHaveBeenCalled()
  })
  it("preserves the contact-email policy before the handoff or provider can start", async () => {
    m.authorize.mockResolvedValue({ allowed: false, message: "Not eligible" })
    expect((await sendMaSourceWorkflowEmailPayload("opp", payload, handoff)).success).toBe(false)
    expect(m.begin).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
})
