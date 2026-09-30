import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  staff: vi.fn(), from: vi.fn(), rpc: vi.fn(), queue: vi.fn(), attempt: vi.fn(),
  reserved: vi.fn(), freshness: vi.fn(), template: vi.fn(), build: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: m.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: m.from, rpc: m.rpc }) }))
vi.mock("@/lib/actions/staff-email-review", () => ({ listStaffEmailReviews: m.queue }))
vi.mock("@/lib/email/staff-email-attempt", () => ({ currentStaffEmailAttempt: m.attempt }))
vi.mock("@/lib/email/staff-email-reserved-dispatch", () => ({ dispatchReservedStaffEmailReview: m.reserved }))
vi.mock("@/lib/opportunity-freshness-send", () => ({ sendOpportunityFreshnessReview: m.freshness }))
vi.mock("@/lib/ma-workflows", () => ({ getMaReviewTemplateVersion: m.template, buildMaReviewedRequest: m.build }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { dispatchStaffEmailBulkItem, getStaffEmailBulk, prepareStaffEmailBulk } from "@/lib/actions/staff-email-bulk"

const batchId = "22400000-0000-4000-8000-000000000100"
const reviewId = "22400000-0000-4000-8000-000000000101"
const sourceId = "22400000-0000-4000-8000-000000000102"
const matchId = "22400000-0000-4000-8000-000000000103"
const review = {
  id: reviewId, source_kind: "ma", source_operation_id: sourceId,
  opportunity_id: "22400000-0000-4000-8000-000000000104", match_id: null,
  recipient_email: "fictional@example.test", namespace: "REAL", state: "pending", version: 1,
  archived_at: null, attempted_payload: null, attempted_at: null,
  template_key: "ma_process_follow_up", template_version: "copy-v1", subject: "Fictional subject",
  body_text: "Complete fictional message", attachment_snapshot: [],
}
const batch = { id: batchId, prepared_by: "staff-one", confirmed_by: "staff-one", confirmed_at: "now", item_count: 1 }
const item = { batch_id: batchId, ordinal: 1, review_id: reviewId, review_snapshot: review,
  members_snapshot: [], snapshot_sha256: "a".repeat(64), state: "not_attempted" }

beforeEach(() => {
  vi.clearAllMocks()
  m.staff.mockResolvedValue({ user: { id: "staff-one" } })
  m.from.mockImplementation((table: string) => {
    const data = table === "staff_email_bulk_batches" ? batch
      : table === "staff_email_bulk_items" ? [item] : review
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }),
      order: async () => ({ data, error: null }) }
    return q
  })
  m.rpc.mockImplementation(async (name: string) => ({ data: name === "staff_email_bulk_claim"
    ? { start: true, claim_token: sourceId, review_attempt_token: reviewId,
        ma_reservation_token: sourceId, handoff_delivery_id: sourceId, handoff_operation_key: sourceId }
    : name === "staff_email_bulk_prepare" ? batchId : null, error: null }))
  m.attempt.mockResolvedValue({ payload: { from: "fictional", to: [review.recipient_email], subject: review.subject,
    text: review.body_text, html: "<p>Fictional</p>", attachments: [] }, fingerprint: "f".repeat(64) })
  m.reserved.mockResolvedValue({ state: "sent", message: "Provider accepted the reviewed email." })
  m.freshness.mockResolvedValue({ state: "sent", message: "Provider accepted the grouped email." })
  m.template.mockResolvedValue("copy-v1")
  m.build.mockImplementation((subject: string, text: string, recipient: string) => ({
    from: "fictional", to: [recipient], subject, text, html: `<p>${text}</p>`,
  }))
})

describe("bounded staff email batch actions", () => {
  it("denies browser callers before service-role access", async () => {
    m.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(getStaffEmailBulk(batchId)).rejects.toThrow("Staff access")
    await expect(dispatchStaffEmailBulkItem(batchId, 1)).rejects.toThrow("Staff access")
    expect(m.from).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("prepares only a distinct bounded exact current-page selection", async () => {
    await expect(prepareStaffEmailBulk({ ids: Array.from({ length: 6 }, () => ({ id: reviewId, version: 1 })),
      page: 1, view: "active", search: "", purpose: "all", sort: "prepared", direction: "desc" })).rejects.toThrow("one to five")
    m.queue.mockResolvedValue({ page: 1, reviews: [{ id: reviewId, version: 1, state: "pending", namespace: "REAL", archived_at: null }] })
    const result = await prepareStaffEmailBulk({ ids: [{ id: reviewId, version: 1 }],
      page: 1, view: "active", search: "", purpose: "all", sort: "prepared", direction: "desc" })
    expect(result.batchId).toBe(batchId)
    expect(m.rpc).toHaveBeenCalledWith("staff_email_bulk_prepare", expect.objectContaining({
      p_review_ids: [reviewId], p_versions: [1], p_page: 1, p_view: "active", p_actor: "staff-one",
    }))
    expect(m.reserved).not.toHaveBeenCalled()
  })

  it.each(["ma", "e4", "e6", "e7", "freshness"] as const)("dispatches %s through its reserved once-only path", async (kind) => {
    m.from.mockImplementation((table: string) => {
      const sourceReview = { ...review, source_kind: kind, match_id: kind === "ma" || kind === "freshness" ? null : matchId }
      const data = table === "staff_email_bulk_batches" ? batch
        : table === "staff_email_bulk_items" ? [{ ...item, review_snapshot: sourceReview }] : sourceReview
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }),
        order: async () => ({ data, error: null }) }
      return q
    })
    m.rpc.mockImplementation(async (name: string) => ({ data: name === "staff_email_bulk_claim"
      ? { start: true, claim_token: sourceId, review_attempt_token: reviewId,
          ma_reservation_token: kind === "ma" || kind === "e4" || kind === "e7" ? sourceId : null,
          handoff_delivery_id: kind === "e4" || kind === "e6" || kind === "e7" ? sourceId : null,
          handoff_operation_key: kind === "e4" || kind === "e6" || kind === "e7" ? sourceId : null }
      : null, error: null }))
    const result = await dispatchStaffEmailBulkItem(batchId, 1)
    expect(result.state).toBe("accepted")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_bulk_claim", expect.objectContaining({ p_batch_id: batchId, p_ordinal: 1 }))
    expect(m.rpc).toHaveBeenCalledWith("staff_email_bulk_finish", expect.objectContaining({ p_outcome: "accepted" }))
    if (kind === "freshness") {
      expect(m.freshness).toHaveBeenCalledOnce()
      expect(m.reserved).not.toHaveBeenCalled()
    } else {
      expect(m.reserved).toHaveBeenCalledOnce()
      const reservation = m.reserved.mock.calls[0][3]
      expect(Boolean(reservation.handoffAttempt)).toBe(kind !== "ma")
      expect(Boolean(reservation.maReservationToken)).toBe(kind === "ma" || kind === "e4" || kind === "e7")
    }
  })

  it("never dispatches a duplicate claim or a stale preclaim review", async () => {
    m.rpc.mockImplementation(async (name: string) => ({ data: name === "staff_email_bulk_claim"
      ? { start: false, state: "started" } : null, error: null }))
    expect((await dispatchStaffEmailBulkItem(batchId, 1)).state).toBe("started")
    expect(m.reserved).not.toHaveBeenCalled()
    m.rpc.mockClear()
    m.from.mockImplementation((table: string) => {
      const data = table === "staff_email_bulk_batches" ? batch
        : table === "staff_email_bulk_items" ? [item] : { ...review, version: 2 }
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }),
        order: async () => ({ data, error: null }) }
      return q
    })
    expect((await dispatchStaffEmailBulkItem(batchId, 1)).state).toBe("blocked")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_bulk_block", expect.anything())
    expect(m.reserved).not.toHaveBeenCalled()
  })

  it("records an unknown postclaim exception as uncertain without replay", async () => {
    m.reserved.mockRejectedValue(new Error("Lost provider response"))
    const result = await dispatchStaffEmailBulkItem(batchId, 1)
    expect(result.state).toBe("uncertain")
    expect(m.rpc).toHaveBeenCalledWith("staff_email_bulk_finish", expect.objectContaining({ p_outcome: "uncertain" }))
    expect(m.reserved).toHaveBeenCalledOnce()
  })
})
