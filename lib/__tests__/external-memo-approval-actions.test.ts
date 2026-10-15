import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import { syntheticPdfBytes } from "./fixtures/synthetic-pdf"
const boundary = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), download: vi.fn(), provider: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: boundary.rpc, storage: { from: () => ({ download: boundary.download }) } }) }))
vi.mock("@/lib/email/resend-client", () => ({ resend: { emails: { send: boundary.provider } } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
import { approveMemoWithExternalNotice } from "@/lib/actions/external-memo-approval"
const id = (n: number) => `25500000-0000-4000-8000-${String(n).padStart(12, "0")}`
const memoBytes = syntheticPdfBytes(2)
const context = { opportunity_id: id(1), repreneur_id: id(2), is_demo: false, cycle_id: id(3), upstream_id: id(4), handoff_type: "e7" as const, e7_evidence_id: id(10), source_office_id: id(5), documents: [], memo: { document_id: id(6), storage_bucket: "opportunity-documents", storage_path: `${id(1)}/memo.pdf`, file_name: "memo.pdf", mime_type: "application/pdf", size_bytes: memoBytes.byteLength, recipient_match_id: null, recipient_repreneur_id: null }, nda_expires_at: "2027-01-01T00:00:00+00:00" }
const input = { matchId: id(7), operationKey: id(8), context, exchangeDate: "2026-10-06", exchangeTime: null, channel: "email" as const, reference: "Synthetic external IM notice" }
beforeEach(() => {
  vi.clearAllMocks()
  boundary.staff.mockResolvedValue({ user: { id: "staff-255", email: "staff@example.test" } })
  boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_memo_context" ? context : id(9), error: null }))
  boundary.download.mockResolvedValue({ data: new Blob([memoBytes]), error: null })
})
afterEach(() => vi.unstubAllEnvs())
describe("authenticated exact memo approval with an already external notice", () => {
  it("verifies retained bytes then commits through one protected transaction with no notifier/provider", async () => {
    expect(await approveMemoWithExternalNotice(input)).toMatchObject({ success: true, grantId: id(9) })
    expect(boundary.rpc).toHaveBeenCalledWith("journey_approve_memo_external_notice", expect.objectContaining({ p_expected_context: context, p_staff_user_id: "staff-255", p_exchange_time: null, p_memo_sha256: createHash("sha256").update(memoBytes).digest("hex") }))
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("denies changed prerequisites before recording any approval", async () => {
    boundary.rpc.mockResolvedValue({ data: null, error: { message: "gate_2_missing" } })
    expect((await approveMemoWithExternalNotice(input)).success).toBe(false)
    expect(boundary.download).not.toHaveBeenCalled()
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_approve_memo_external_notice", expect.anything())
  })
  it("rejects changed memo bytes/size before granting access", async () => {
    boundary.download.mockResolvedValue({ data: new Blob(["different bytes"]), error: null })
    expect((await approveMemoWithExternalNotice(input)).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_approve_memo_external_notice", expect.anything())
  })
  it("preserves the recipient-specific recording pause without disabling a reusable memo", async () => {
    vi.stubEnv("RECIPIENT_IM_OPERATIONS_DISABLED", "1")
    const recipientContext = { ...context, memo: { ...context.memo, recipient_match_id: input.matchId, recipient_repreneur_id: context.repreneur_id } }
    boundary.rpc.mockResolvedValue({ data: recipientContext, error: null })
    expect((await approveMemoWithExternalNotice({ ...input, context: recipientContext })).success).toBe(false)
    expect(boundary.download).not.toHaveBeenCalled()
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_approve_memo_external_notice", expect.anything())
    boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_memo_context" ? context : id(9), error: null }))
    expect((await approveMemoWithExternalNotice(input)).success).toBe(true)
  })
  it("rejects a corrupt stored memo even when its byte size and PDF metadata match", async () => {
    boundary.download.mockResolvedValue({ data: new Blob([new Uint8Array(memoBytes.byteLength)]), error: null })
    expect((await approveMemoWithExternalNotice(input)).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_approve_memo_external_notice", expect.anything())
  })
  it("requires staff before any persistence or storage", async () => {
    boundary.staff.mockRejectedValue(new Error("Staff required"))
    await expect(approveMemoWithExternalNotice(input)).rejects.toThrow("Staff required")
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.download).not.toHaveBeenCalled()
  })
})
