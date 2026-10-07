import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), provider: vi.fn(), selection: vi.fn(), download: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: boundary.rpc, storage: { from: () => ({ download: boundary.download }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: boundary.selection }) }) }) }) }))
vi.mock("@/lib/email/resend-client", () => ({ resend: { emails: { send: boundary.provider } } }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/env", () => ({ env: { BETTER_AUTH_SECRET: "synthetic-test-only-secret" } }))

import { issueStaffPortalSelection } from "@/lib/staff-portal-selection"
import { recordExternalPursuitHandoff } from "@/lib/actions/external-pursuit-handoffs"

const input = {
  matchId: "25400000-0000-4000-8000-000000000001",
  context: { opportunity_id: "25400000-0000-4000-8000-000000000002", repreneur_id: "25400000-0000-4000-8000-000000000003", is_demo: false, cycle_id: "25400000-0000-4000-8000-000000000004", upstream_id: "25400000-0000-4000-8000-000000000005", handoff_type: "e6" as const, source_office_id: null, documents: [] },
  operationKey: "25400000-0000-4000-8000-000000000006",
  exchangeDate: "2026-10-06", exchangeTime: null, channel: "phone" as const, reference: "Call with buyer about the retained NDA",
}
beforeEach(() => {
  vi.clearAllMocks()
  boundary.staff.mockResolvedValue({ user: { id: "staff-254", email: "staff@example.test" } })
  boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_handoff_context" ? input.context : "25400000-0000-4000-8000-000000000007", error: null }))
})
describe("staff records a completed external pursuit handoff", () => {
  it("records date-only E6 through the protected service with authentic staff and zero provider I/O", async () => {
    const result = await recordExternalPursuitHandoff(input)
    expect(result).toEqual({ success: true, eventId: "25400000-0000-4000-8000-000000000007", message: "External exchange recorded. No email was sent." })
    expect(boundary.rpc).toHaveBeenCalledWith("journey_record_external_handoff", expect.objectContaining({ p_exchange_date: "2026-10-06", p_exchange_time: null, p_staff_user_id: "staff-254", p_staff_email: "staff@example.test", p_expected_context: input.context }))
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("denies a non-staff session before database or provider effects", async () => {
    boundary.staff.mockRejectedValue(new Error("Staff access required"))
    await expect(recordExternalPursuitHandoff(input)).rejects.toThrow("Staff access required")
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it.each([
    { exchangeDate: "" }, { reference: "   " }, { exchangeTime: "25:00" }, { channel: "unsupported" },
  ])("refuses malformed minimum evidence before recording (%s)", async (change) => {
    expect((await recordExternalPursuitHandoff({ ...input, ...change } as typeof input)).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("binds an authentic selected-owner capability to the transaction", async () => {
    const workspace = "25400000-0000-4000-8000-000000000008"
    const generation = "25400000-0000-4000-8000-000000000009"
    const token = issueStaffPortalSelection(input.context.repreneur_id, "staff-254", workspace, generation)
    boundary.selection.mockResolvedValue({ data: { selected_repreneur_id: input.context.repreneur_id, staff_user_id: "staff-254", generation }, error: null })
    expect((await recordExternalPursuitHandoff({ ...input, selectionToken: token })).success).toBe(true)
    expect(boundary.rpc).toHaveBeenCalledWith("journey_record_external_handoff", expect.objectContaining({ p_workspace_id: workspace, p_workspace_generation: generation }))
  })
  it("rejects an owner switch or another staff actor's capability", async () => {
    const token = issueStaffPortalSelection(input.context.repreneur_id, "staff-254", "25400000-0000-4000-8000-000000000008", "25400000-0000-4000-8000-000000000009")
    boundary.selection.mockResolvedValue({ data: { selected_repreneur_id: "another-owner", staff_user_id: "staff-254", generation: "25400000-0000-4000-8000-000000000009" }, error: null })
    expect((await recordExternalPursuitHandoff({ ...input, selectionToken: token })).success).toBe(false)
    boundary.staff.mockResolvedValue({ user: { id: "another-staff", email: "other@example.test" } })
    expect((await recordExternalPursuitHandoff({ ...input, selectionToken: token })).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("reports protected prerequisite failure without proposing a pending completion or sending", async () => {
    boundary.rpc.mockResolvedValue({ data: null, error: { message: "external_handoff_approval_not_ready" } })
    expect((await recordExternalPursuitHandoff(input)).success).toBe(false)
    expect(boundary.provider).not.toHaveBeenCalled()
  })

  it("refuses a retained phase file whose bytes no longer match its canonical hash", async () => {
    const document = { artifact_id: "25400000-0000-4000-8000-000000000010", document_id: "25400000-0000-4000-8000-000000000011", version: 1, role: "blank_template" as const, file_name: "test.pdf", mime_type: "application/pdf", content_sha256: "a".repeat(64), storage_bucket: "opportunity-documents", storage_path: `${input.context.opportunity_id}/nda-artifacts/blank_template/test.pdf`, size_bytes: 5 }
    const fileInput = { ...input, context: { ...input.context, documents: [document] } }
    boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_handoff_context" ? fileInput.context : "25400000-0000-4000-8000-000000000007", error: null }))
    boundary.download.mockResolvedValue({ data: new Blob(["wrong"]), error: null })
    expect((await recordExternalPursuitHandoff(fileInput)).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_record_external_handoff", expect.anything())
    expect(boundary.provider).not.toHaveBeenCalled()
  })

  it("records E6 with retrieved exact retained bytes without preparing or calling an email provider", async () => {
    const document = { artifact_id: "25400000-0000-4000-8000-000000000010", document_id: "25400000-0000-4000-8000-000000000011", version: 1, role: "blank_template" as const, file_name: "test.pdf", mime_type: "application/pdf", content_sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", storage_bucket: "opportunity-documents", storage_path: `${input.context.opportunity_id}/nda-artifacts/blank_template/test.pdf`, size_bytes: 5 }
    const fileInput = { ...input, context: { ...input.context, documents: [document] } }
    boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_handoff_context" ? fileInput.context : "25400000-0000-4000-8000-000000000007", error: null }))
    boundary.download.mockResolvedValue({ data: new Blob(["hello"]), error: null })
    expect((await recordExternalPursuitHandoff(fileInput)).success).toBe(true)
    expect(boundary.provider).not.toHaveBeenCalled()
  })

})
