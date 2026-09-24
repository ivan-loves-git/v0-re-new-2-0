import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  staff: vi.fn(), rpc: vi.fn(), from: vi.fn(), context: vi.fn(), version: vi.fn(), render: vi.fn(),
  build: vi.fn(), sourceSend: vi.fn(), handoff: vi.fn(), e6: vi.fn(), pursue: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: m.from, rpc: m.rpc }) }))
vi.mock("@/lib/ma-workflows", () => ({
  getMaReviewContext: m.context, getMaReviewTemplateVersion: m.version,
  renderMaWorkflowContent: m.render, buildMaReviewedRequest: m.build,
  sendMaSourceWorkflowEmailPayload: m.sourceSend,
}))
vi.mock("@/lib/pursuit-handoff-delivery", () => ({ preparePursuitHandoff: m.handoff }))
vi.mock("@/lib/actions/opportunity-pursuit-handoffs", () => ({ sendPursuitIntermediaryHandoff: m.pursue, sendPursuitNdaReadyNotice: m.e6 }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/staff-email-review-guard", () => ({ sameAttachmentSnapshot: () => true }))

import { approveAndSendStaffEmailReview, prepareMaEmailReview } from "@/lib/actions/staff-email-review"

const reviewId = "18600000-0000-4000-8000-000000000010"
const opportunityId = "18600000-0000-4000-8000-000000000011"
const sourceId = "18600000-0000-4000-8000-000000000012"
const contactId = "18600000-0000-4000-8000-000000000013"
const row = {
  id: reviewId, source_kind: "ma", source_operation_id: sourceId, opportunity_id: opportunityId,
  match_id: null, upstream_evidence_id: null, contact_link_id: contactId,
  recipient_email: "source@example.test", namespace: "REAL", template_key: "ma_opportunity_validity_check",
  template_version: "copy-v1", subject: "Current subject", body_text: "Current body",
  attachment_snapshot: [], state: "pending", version: 1, approved_by: "staff-1",
}

function query(result: unknown) {
  const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: result, error: null }) }
  return q
}

beforeEach(() => {
  vi.clearAllMocks()
  m.staff.mockResolvedValue({ user: { id: "staff-1", email: "staff@example.test" } })
  m.context.mockResolvedValue({ opportunityId, namespace: "REAL", contactLinkId: contactId, recipientEmail: "source@example.test", activeMatchId: null })
  m.version.mockResolvedValue("copy-v1")
  m.render.mockImplementation(async (_opportunityId, subject, body) => ({ subject, body }))
  m.build.mockImplementation((subject, body, to) => ({ from: "Re-New <noreply@example.test>", to: [to], subject, html: `<p>${body}</p>`, text: body }))
  m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? row : table === "ma_interactions" ? { id: "evidence", provider_message_id: "accepted" } : null))
  m.rpc.mockImplementation(async (name) => ({ data: name === "staff_email_review_prepare" ? reviewId : name === "staff_email_review_reserve" ? sourceId : null, error: null }))
  m.sourceSend.mockResolvedValue({ success: true, message: "accepted", operationState: "sent" })
})

describe("staff email review public actions", () => {
  it("denies preparation before service-role access for a non-staff actor", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(prepareMaEmailReview({ opportunityId, sourceOperationId: sourceId, templateKey: row.template_key, contactLinkId: contactId, subject: row.subject, body: row.body_text })).rejects.toThrow("Staff access")
    expect(m.from).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("prepares one durable source operation without provider I/O", async () => {
    const prepared = await prepareMaEmailReview({ opportunityId, sourceOperationId: sourceId, templateKey: row.template_key, contactLinkId: contactId, subject: row.subject, body: row.body_text })
    expect(prepared.reviewId).toBe(reviewId)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_prepare", expect.objectContaining({ p_source_operation_id: sourceId, p_actor: "staff-1", p_namespace: "REAL" }))
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("rejects a stale approval before reservation or provider I/O", async () => {
    await expect(approveAndSendStaffEmailReview(reviewId, 0)).rejects.toThrow("changed")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("fails closed when a catalogue key is inactive at approval", async () => {
    m.version.mockRejectedValue(new Error("This catalogue email is disabled in Templates."))
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).rejects.toThrow("disabled")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("fails closed when the canonical contact email drifted after preparation", async () => {
    m.context.mockResolvedValue({ opportunityId, namespace: "REAL", contactLinkId: contactId, recipientEmail: "changed@example.test", activeMatchId: null })
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).rejects.toThrow("recipient changed")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("does not reserve a DEMO draft for production delivery", async () => {
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? { ...row, namespace: "DEMO" } : null))
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).rejects.toThrow("DEMO drafts cannot deliver")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("does not send a draft pinned to an older catalogue copy", async () => {
    m.version.mockResolvedValue("copy-v2")
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).rejects.toThrow("template changed")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("reserves the exact reviewed content and records accepted evidence once", async () => {
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("sent")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_reserve", expect.objectContaining({ p_review_id: reviewId, p_version: 1, p_payload: expect.objectContaining({ subject: row.subject, text: row.body_text, to: [row.recipient_email] }) }))
    expect(m.sourceSend).toHaveBeenCalledWith(opportunityId, expect.objectContaining({ clientOperationKey: sourceId, subject: row.subject, body: row.body_text }), undefined, expect.objectContaining({ actorId: "staff-1" }))
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_finish", expect.objectContaining({ p_state: "sent", p_provider_message_id: "accepted", p_delivery_evidence_id: "evidence" }))
  })

  it("retains an uncertain outcome instead of minting another operation", async () => {
    m.sourceSend.mockResolvedValue({ success: false, message: "Unknown provider result", operationState: "pending" })
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("uncertain")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_finish", expect.objectContaining({ p_state: "uncertain", p_error: "Unknown provider result" }))
    expect(m.sourceSend.mock.calls[0][1].clientOperationKey).toBe(sourceId)
  })

  it("does not call an accepted source send failed when lock release needs reconciliation", async () => {
    m.sourceSend.mockResolvedValue({ success: false, message: "Provider accepted; lock release needs reconciliation", operationState: "sent" })
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("uncertain")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_finish", expect.objectContaining({ p_state: "uncertain" }))
  })

  it("does not claim sent when the authoritative source receipt cannot be read", async () => {
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? row : null))
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("uncertain")
    expect(result.message).toContain("receipt could not be read")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_finish", expect.objectContaining({ p_state: "uncertain", p_provider_message_id: null, p_delivery_evidence_id: null }))
  })
})
