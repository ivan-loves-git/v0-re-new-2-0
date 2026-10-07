import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  staff: vi.fn(), rpc: vi.fn(), from: vi.fn(), context: vi.fn(), version: vi.fn(), render: vi.fn(),
  build: vi.fn(), sourceSend: vi.fn(), handoff: vi.fn(), e6: vi.fn(), pursue: vi.fn(),
  e6Copy: vi.fn(), fixedCopy: vi.fn(),
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
vi.mock("@/lib/pursuit-handoff-copy", () => ({
  buildPursuitNdaReadyRequest: m.e6Copy, fixedIntermediaryHandoffCopy: m.fixedCopy,
}))

import { approveAndSendStaffEmailReview, archiveStaffEmailReview, changeStaffEmailReviewArchiveSelection, editStaffEmailReview, getStaffEmailReview, listStaffEmailReviews, prepareMaEmailReview, preparePursuitEmailReview, restoreStaffEmailReview } from "@/lib/actions/staff-email-review"

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
  archived_at: null,
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
  m.e6Copy.mockReturnValue({ from: "Re-New <noreply@example.test>", to: ["buyer@example.test"], subject: "NDA ready", html: "<p>Ready</p>", text: "Ready" })
  m.fixedCopy.mockReturnValue({ subject: "Fixed subject", body: "Fixed body" })
  m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? row : table === "ma_interactions" ? { id: "evidence", delivery_status: "sent", provider_message_id: "accepted" } : null))
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

  it.each([
    "ma_opportunity_validity_check", "ma_request_more_information", "ma_repreneur_interest_feedback",
    "ma_nda_info_memo_request", "ma_process_follow_up",
  ])("prepares %s as a durable draft without provider I/O", async (templateKey) => {
    m.context.mockResolvedValue({ opportunityId, namespace: "REAL", contactLinkId: contactId, recipientEmail: "source@example.test", activeMatchId: contactId })
    const prepared = await prepareMaEmailReview({ opportunityId, sourceOperationId: sourceId, templateKey, contactLinkId: contactId, subject: row.subject, body: row.body_text })
    expect(prepared.reviewId).toBe(reviewId)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_prepare", expect.objectContaining({ p_source_operation_id: sourceId, p_template_key: templateKey, p_actor: "staff-1", p_namespace: "REAL" }))
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it.each([
    { kind: "e4" as const, templateKey: "ma_nda_info_memo_request", attachments: [] },
    { kind: "e6" as const, templateKey: "code:e6_nda_ready", attachments: [] },
    { kind: "e7" as const, templateKey: "ma_nda_info_memo_request", attachments: [{ artifact_id: contactId, document_id: reviewId, content_sha256: "a".repeat(64), file_name: "signed.pdf", mime_type: "application/pdf", size_bytes: 234 }] },
  ])("prepares $kind against its exact current upstream event without provider I/O", async ({ kind, templateKey, attachments }) => {
    m.handoff.mockResolvedValue({ handoff: { upstreamId: sourceId, opportunityId, snapshot: attachments },
      context: { opportunity: { is_demo: false }, repreneur: { email: "buyer@example.test" }, upstream: { metadata: { blank_nda_present_at_validation: true } } } })
    const prepared = await preparePursuitEmailReview(contactId, kind)
    expect(prepared.reviewId).toBe(reviewId)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_prepare", expect.objectContaining({
      p_source_kind: kind, p_source_operation_id: sourceId, p_upstream_evidence_id: sourceId,
      p_template_key: templateKey, p_attachment_snapshot: attachments,
    }))
    expect(m.sourceSend).not.toHaveBeenCalled()
    expect(m.e6).not.toHaveBeenCalled()
    expect(m.pursue).not.toHaveBeenCalled()
  })

  it("does not list staff drafts for an unauthenticated or repreneur caller", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(listStaffEmailReviews({ page: 1, view: "active", search: "", purpose: "all", sort: "prepared", direction: "desc" })).rejects.toThrow("Staff access")
    expect(m.from).not.toHaveBeenCalled()
  })

  it("denies detail metadata before service access for a non-staff caller", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(getStaffEmailReview(reviewId)).rejects.toThrow("Staff access")
    expect(m.from).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("returns only display metadata owned by the exact review recipient and opportunity", async () => {
    const recipient = { recipient_email: row.recipient_email, recipient_name: "Fictional Source", company_name: "Fictional Firm", purpose_label: "Validity check" }
    const opportunity = { id: opportunityId, reference: "QA-222", public_title: "Fictional opportunity" }
    m.from.mockImplementation((table) => {
      const data = table === "staff_email_reviews" ? row : table === "staff_email_review_queue" ? recipient : table === "opportunities" ? opportunity : null
      const q = { select: () => q, eq: () => q, order: () => q,
        limit: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data, error: null }) }
      return q
    })
    m.rpc.mockResolvedValue({ data: true, error: null })
    expect((await getStaffEmailReview(reviewId)).display).toEqual({ recipient, opportunity })
    recipient.recipient_email = "another@example.invalid"
    opportunity.id = "another-opportunity"
    expect((await getStaffEmailReview(reviewId)).display).toEqual({ recipient: null, opportunity: null })
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("keeps records beyond the old latest-50 boundary navigable", async () => {
    const range = vi.fn().mockResolvedValue({ data: [{ ...row, id: "older-review" }], count: 51, error: null })
    const listQuery = {
      in: () => listQuery, is: () => listQuery, not: () => listQuery, eq: () => listQuery, ilike: () => listQuery,
      order: () => listQuery, range,
      then: (resolve: (value: { count: number; error: null }) => void) => Promise.resolve({ count: 51, error: null }).then(resolve),
    }
    m.from.mockReturnValue({ select: () => listQuery })
    const page = await listStaffEmailReviews({ page: 3, view: "all", search: "", purpose: "all", sort: "prepared", direction: "desc" })
    expect(range).toHaveBeenCalledWith(50, 74)
    expect(page).toMatchObject({ total: 51, page: 3, pageSize: 25, reviews: [{ id: "older-review" }] })
  })

  it("applies active/purpose/search and stable sort before selecting the requested page", async () => {
    const operations: string[] = []
    m.from.mockImplementation(() => ({
      select: (_columns: string, options: { head: boolean }) => {
        const record = !options.head
        const q = {
          in: () => { if (record) operations.push("active"); return q },
          is: () => { if (record) operations.push("unarchived"); return q },
          not: () => q,
          eq: (...[, value]: [string, string]) => { if (record) operations.push(`purpose:${value}`); return q },
          ilike: (...[, value]: [string, string]) => { if (record) operations.push(`search:${value}`); return q },
          order: (key: string, options: { ascending: boolean }) => { if (record) operations.push(`order:${key}:${options.ascending}`); return q },
          range: (first: number, last: number) => {
            operations.push(`range:${first}-${last}`)
            return Promise.resolve({ data: [], error: null })
          },
          then: (resolve: (value: { count: number; error: null }) => void) =>
            Promise.resolve({ count: 50, error: null }).then(resolve),
        }
        return q
      },
    }))
    await listStaffEmailReviews({
      page: 2, view: "active", search: "Acme", purpose: "e7_signed_copies",
      sort: "purpose", direction: "asc",
    })
    expect(operations).toEqual([
      "unarchived", "active", "purpose:e7_signed_copies", "search:%Acme%",
      "order:purpose_sort:true", "order:created_at:false", "order:id:false", "range:25-49",
    ])
  })

  it("sends grouped staff edits to the freshness RPC with its exact body parameter", async () => {
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? { ...row, source_kind: "freshness" } : null))
    await editStaffEmailReview(reviewId, 1, "Reviewed group", "Reviewed words")
    expect(m.rpc).toHaveBeenCalledWith("opportunity_freshness_edit", {
      p_review_id: reviewId, p_version: 1, p_subject: "Reviewed group",
      p_body: "Reviewed words", p_actor: "staff-1",
    })
  })

  it("explains why an earlier uncertain send blocks another draft", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "staff_email_review_unresolved_source_blocks_new_draft" } })
    await expect(prepareMaEmailReview({ opportunityId, sourceOperationId: sourceId, templateKey: row.template_key,
      contactLinkId: contactId, subject: row.subject, body: row.body_text })).rejects.toThrow("Reopen that review")
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("rejects a stale approval before reservation or provider I/O", async () => {
    await expect(approveAndSendStaffEmailReview(reviewId, 0)).rejects.toThrow("changed")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("saves an editable message with CAS and sends only its read-back canonical version and words", async () => {
    const subject = "New saved subject"
    const body = "Complete new saved body"
    await editStaffEmailReview(reviewId, 1, subject, body)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_edit", {
      p_review_id: reviewId, p_version: 1, p_subject: subject, p_body_text: body, p_actor: "staff-1",
    })
    expect(m.sourceSend).not.toHaveBeenCalled()
    const saved = { ...row, version: 2, subject, body_text: body }
    m.from.mockImplementation(table => query(table === "staff_email_reviews" ? saved : table === "ma_interactions" ? { id: "evidence", delivery_status: "sent", provider_message_id: "accepted" } : null))
    m.rpc.mockClear()
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).rejects.toThrow("changed")
    expect(m.rpc).not.toHaveBeenCalled()
    expect(m.sourceSend).not.toHaveBeenCalled()
    await approveAndSendStaffEmailReview(reviewId, 2)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_reserve", expect.objectContaining({ p_review_id: reviewId, p_version: 2 }))
    expect(m.build).toHaveBeenCalledWith(subject, body, row.recipient_email)
    expect(m.sourceSend).toHaveBeenCalledTimes(1)
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

  it("sends the retained individually reviewed words after reusable copy changes", async () => {
    m.version.mockResolvedValue("copy-v2")
    await expect(approveAndSendStaffEmailReview(reviewId, 1)).resolves.toMatchObject({ state: "sent" })
    expect(m.sourceSend).toHaveBeenCalledWith(opportunityId, expect.objectContaining({ subject: row.subject, body: row.body_text }), undefined, expect.anything())
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

  it("retains earlier MA uncertainty when a later gate or suppression veto prevents source I/O", async () => {
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? { ...row, state: "uncertain" } : null))
    m.sourceSend.mockResolvedValue({ success: false, message: "Recipient became suppressed before provider I/O" })
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("uncertain")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_finish", expect.objectContaining({ p_state: "uncertain" }))
  })

  it("resolves an older unknown outcome only when its exact source record finalized a rejection", async () => {
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? { ...row, state: "uncertain" }
      : table === "ma_interactions" ? { id: "evidence", delivery_status: "failed", provider_message_id: null } : null))
    m.sourceSend.mockResolvedValue({ success: false, message: "Gate changed before replay" })
    const result = await approveAndSendStaffEmailReview(reviewId, 1)
    expect(result.state).toBe("failed")
    expect(result.message).toContain("source delivery record confirms")
  })

  it("retains earlier E6 uncertainty when a later suppression veto occurs before begin", async () => {
    const e6Review = { ...row, source_kind: "e6", match_id: contactId, upstream_evidence_id: sourceId,
      contact_link_id: null, template_key: "code:e6_nda_ready", template_version: "w112-e6-v1",
      recipient_email: "buyer@example.test", subject: "NDA ready", body_text: "Ready", state: "uncertain" }
    m.from.mockImplementation((table) => query(table === "staff_email_reviews" ? e6Review : null))
    m.handoff.mockResolvedValue({ handoff: { upstreamId: sourceId, snapshot: [] },
      context: { opportunity: { is_demo: false }, repreneur: { email: "buyer@example.test" } } })
    m.e6.mockResolvedValue({ success: false, message: "Recipient suppressed", operationState: "failed" })
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

  it("binds archive and restore to current staff and exact version without provider I/O", async () => {
    m.rpc.mockImplementation(async (name) => ({ data: name === "staff_email_review_archive" ? 2 : name === "staff_email_review_restore" ? 3 : null, error: null }))
    expect((await archiveStaffEmailReview(reviewId, 1)).message).toContain("No email was sent")
    expect((await restoreStaffEmailReview(reviewId, 2)).message).toContain("Same draft")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_archive", { p_review_id: reviewId, p_version: 1, p_actor: "staff-1" })
    expect(m.rpc).toHaveBeenCalledWith("staff_email_review_restore", { p_review_id: reviewId, p_version: 2, p_actor: "staff-1" })
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("fails closed on stale archive, invalid IDs, and non-staff callers", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "stale" } })
    await expect(archiveStaffEmailReview(reviewId, 1)).rejects.toThrow("changed")
    await expect(archiveStaffEmailReview("not-a-review", 1)).rejects.toThrow("valid review")
    expect(m.rpc).toHaveBeenCalledTimes(1)
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(restoreStaffEmailReview(reviewId, 2)).rejects.toThrow("Staff access")
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("reports mixed current-page archive outcomes without treating a stale row as success", async () => {
    const secondId = "18600000-0000-4000-8000-000000000020"
    m.rpc.mockImplementation(async (_name, args) => ({ data: args.p_review_id === reviewId ? 2 : null,
      error: args.p_review_id === reviewId ? null : { message: "stale" } }))
    const result = await changeStaffEmailReviewArchiveSelection([
      { id: reviewId, version: 1 }, { id: secondId, version: 1 },
    ], "archive")
    expect(result.outcomes).toEqual([{ id: reviewId, outcome: "archived" }, { id: secondId, outcome: "blocked" }])
    expect(result.message).toContain("1 of 2")
    expect(m.sourceSend).not.toHaveBeenCalled()
  })

  it("rejects duplicate, oversized, or tampered page selections before RPCs", async () => {
    await expect(changeStaffEmailReviewArchiveSelection([{ id: reviewId, version: 1 }, { id: reviewId, version: 1 }], "archive")).rejects.toThrow("distinct")
    await expect(changeStaffEmailReviewArchiveSelection(Array.from({ length: 26 }, (_, i) => ({
      id: `18600000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, version: 1,
    })), "restore")).rejects.toThrow("up to 25")
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
