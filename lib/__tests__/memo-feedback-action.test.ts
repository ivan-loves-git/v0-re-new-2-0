import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ requireStaffAccess: vi.fn(), createAdminClient: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
import { recordMemoFeedback } from "@/lib/actions/memo-feedback"

const input = {
  matchId: "74000000-0000-4000-8000-000000000007",
  grantEvidenceId: "74000000-0000-4000-8000-000000000101",
  channel: "phone" as const,
  receivedAt: "2026-09-22T12:33:00.000Z",
}

function fakeDb(status = "suppressed", rpcError: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcError ? null : "receipt-1", error: rpcError })
  const maybeSingle = vi.fn().mockResolvedValue({ data: { status }, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn().mockReturnValue({ select }) })
  return rpc
}

function failureCategory() {
  const logged = vi.mocked(console.error).mock.calls
    .map(([entry]) => JSON.parse(String(entry)) as { error_category?: string })
  return logged.at(-1)?.error_category
}

describe("staff exact-grant memo feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.requireStaffAccess.mockResolvedValue({ user: { email: "staff@example.test" } })
  })

  it("records the displayed grant ID, channel and absolute receipt instant", async () => {
    const rpc = fakeDb()
    const result = await recordMemoFeedback(input)
    expect(result).toMatchObject({ success: true, evidenceId: "receipt-1" })
    expect(result.message).toContain("unsent reminder was cancelled")
    expect(rpc).toHaveBeenCalledWith("w174_record_memo_feedback", {
      p_match_id: input.matchId, p_grant_evidence_id: input.grantEvidenceId,
      p_actor: "staff@example.test", p_channel: "phone", p_received_at: input.receivedAt,
    })
  })

  it("does not reinterpret a stale displayed grant as a new current grant", async () => {
    fakeDb("pending", { message: "The displayed memo grant is stale." })
    await expect(recordMemoFeedback(input)).resolves.toMatchObject({
      success: false, message: expect.stringContaining("Refresh"),
    })
    expect(failureCategory()).toBe("precondition_failed")
  })

  it("treats normal receipt validation as non-alertable, preserving actual DB failures", async () => {
    fakeDb("pending", { message: "Record an actual email or phone receipt time." })
    await recordMemoFeedback(input)
    expect(failureCategory()).toBe("validation_failed")
    vi.mocked(console.error).mockClear()
    fakeDb("pending", { message: "Synthetic unavailable database" })
    await recordMemoFeedback(input)
    expect(failureCategory()).toBe("persistence_failed")
  })

  it("never claims an uncertain in-flight provider attempt was definitely cancelled", async () => {
    fakeDb("review_required")
    const result = await recordMemoFeedback(input)
    expect(result.success).toBe(true)
    expect(result.message).toContain("may already have started")
  })

  it("requires staff access before touching a service client", async () => {
    mocks.requireStaffAccess.mockRejectedValue(new Error("unauthorized"))
    await expect(recordMemoFeedback(input)).rejects.toThrow("unauthorized")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
