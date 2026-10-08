import { createHash } from "node:crypto"
import { syntheticPdfBytes } from "./fixtures/synthetic-pdf"
import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({ staff: vi.fn(), rpc: vi.fn(), provider: vi.fn(), selection: vi.fn(), download: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.staff }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: boundary.rpc, storage: { from: () => ({ download: boundary.download, upload: boundary.upload, remove: boundary.remove }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: boundary.selection }) }) }) }) }))
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
  it("denies a new external E4 without a current authorized PDF version before qualifying effects", async () => {
    const missingLdc = { ...input, context: { ...input.context, handoff_type: "e4" as const } }
    boundary.rpc.mockImplementation(async (name: string) => ({ data: name === "journey_external_handoff_context" ? missingLdc.context : "25400000-0000-4000-8000-000000000007", error: null }))
    expect((await recordExternalPursuitHandoff(missingLdc)).success).toBe(false)
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_record_external_handoff", expect.anything())
    expect(boundary.provider).not.toHaveBeenCalled()
  })

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

const pdf = syntheticPdfBytes(1)
const hash = createHash("sha256").update(pdf).digest("hex")
const e4Input = { ...input, context: { ...input.context, handoff_type: "e4" as const, ldc: {
  source_object_id: "25400000-0000-4000-8000-000000000020", source_version: "source-version-a",
  source_updated_at: "2026-10-07T12:00:00+00:00", profile_source_sha256: "b".repeat(64),
  source_path: `cvs/${input.context.repreneur_id}/ldc/source.pdf`, source_upload_id: null,
  file_name: "Lettre-de-cadrage.pdf", mime_type: "application/pdf" as const, size_bytes: pdf.byteLength, content_sha256: hash,
} } }
const ownStage = { stage_id: "25400000-0000-4000-8000-000000000021",
  storage_path: `pursuit-ldc-evidence/${input.context.repreneur_id}/ldc/${input.operationKey}/25400000-0000-4000-8000-000000000021.pdf`, retained: false }
function e4Boundary() {
  boundary.download.mockResolvedValue({ data: new Blob([Uint8Array.from(pdf)]), error: null })
  boundary.upload.mockResolvedValue({ data: {}, error: null })
  boundary.remove.mockResolvedValue({ data: [], error: null })
  boundary.rpc.mockImplementation(async (name: string) => ({ error: null, data:
    name === "journey_external_ldc_replay" ? null : name === "journey_external_handoff_context" ? e4Input.context :
    name === "journey_stage_external_ldc" ? ownStage : name === "journey_claim_ldc_cleanup" ? [] : "25400000-0000-4000-8000-000000000007" }))
}
describe("E4 binds the existing current private LDC PDF", () => {
  beforeEach(e4Boundary)
  it("rechecks the selected workspace on a committed retry before any source read or new effect", async () => {
    const workspace = "25400000-0000-4000-8000-000000000008", generation = "25400000-0000-4000-8000-000000000009"
    const token = issueStaffPortalSelection(e4Input.context.repreneur_id, "staff-254", workspace, generation)
    boundary.selection.mockResolvedValue({ data: { selected_repreneur_id: e4Input.context.repreneur_id, staff_user_id: "staff-254", generation }, error: null })
    boundary.rpc.mockResolvedValue({ data: null, error: { message: "staff_portal_workspace_stale" } })
    expect((await recordExternalPursuitHandoff({ ...e4Input, selectionToken: token })).success).toBe(false)
    expect(boundary.rpc).toHaveBeenCalledWith("journey_external_ldc_replay", expect.objectContaining({ p_workspace_id: workspace, p_workspace_generation: generation }))
    expect(boundary.download).not.toHaveBeenCalled()
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("parses actual PDF bytes and retains the exact selected version before atomic recording, without a validation milestone or provider", async () => {
    expect((await recordExternalPursuitHandoff(e4Input)).success).toBe(true)
    expect(boundary.upload).toHaveBeenCalledWith(ownStage.storage_path, expect.any(Uint8Array), { contentType: "application/pdf", upsert: false, metadata: { sha256: hash } })
    expect(boundary.rpc).toHaveBeenCalledWith("journey_record_external_handoff", expect.objectContaining({ p_expected_context: e4Input.context }))
    expect(boundary.remove).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it.each([
    { mime_type: "application/msword" }, { file_name: "LDC.docx" }, { size_bytes: pdf.byteLength + 1 },
    { content_sha256: "f".repeat(64) }, { source_object_id: "missing" },
  ])("denies invalid current source metadata (%s) without staging or qualifying effects", async (change) => {
    const context = { ...e4Input.context, ldc: { ...e4Input.context.ldc, ...change } }
    boundary.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "journey_external_handoff_context" ? context : null }))
    expect((await recordExternalPursuitHandoff({ ...e4Input, context } as typeof e4Input)).success).toBe(false)
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_record_external_handoff", expect.anything())
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it.each([null, "renamed non-PDF bytes"])('denies unavailable or renamed non-PDF source bytes (%s)', async (content) => {
    const context = { ...e4Input.context, ldc: { ...e4Input.context.ldc, content_sha256: null, size_bytes: content?.length ?? pdf.byteLength } }
    boundary.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === "journey_external_handoff_context" ? context : null }))
    boundary.download.mockResolvedValue({ data: content === null ? null : new Blob([content]), error: null })
    expect((await recordExternalPursuitHandoff({ ...e4Input, context })).success).toBe(false)
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it.each([{ is_demo: true }, { repreneur_id: "25400000-0000-4000-8000-000000000030" },
    { ldc: { ...e4Input.context.ldc, source_version: "old-version" } }])("denies an owner, namespace or source-version switch (%s)", async (change) => {
    expect((await recordExternalPursuitHandoff({ ...e4Input, context: { ...e4Input.context, ...change } })).success).toBe(false)
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.rpc).not.toHaveBeenCalledWith("journey_record_external_handoff", expect.anything())
  })
  it("cleans only its positively claimed failed staging after a protected commit denial", async () => {
    const rpc = boundary.rpc.getMockImplementation()!
    boundary.rpc.mockImplementation(async (name: string, args: unknown) => name === "journey_record_external_handoff"
      ? { data: null, error: { message: "external_handoff_context_changed" } }
      : name === "journey_claim_ldc_cleanup" ? { data: [{ id: ownStage.stage_id, storage_path: ownStage.storage_path, state: "cleanup" }], error: null } : rpc(name, args))
    expect((await recordExternalPursuitHandoff(e4Input)).success).toBe(false)
    expect(boundary.remove).toHaveBeenCalledExactlyOnceWith([ownStage.storage_path])
    expect(boundary.rpc).toHaveBeenCalledWith("journey_complete_ldc_cleanup", { p_stage_id: ownStage.stage_id })
    expect(boundary.provider).not.toHaveBeenCalled()
  })
  it("does not delete when a lost commit response is resolved as a retained version", async () => {
    const rpc = boundary.rpc.getMockImplementation()!
    boundary.rpc.mockImplementation(async (name: string, args: unknown) => { if (name === "journey_record_external_handoff") throw new Error("lost response after commit"); return rpc(name, args) })
    expect((await recordExternalPursuitHandoff(e4Input)).success).toBe(false)
    expect(boundary.rpc).toHaveBeenCalledWith("journey_claim_ldc_cleanup", { p_stage_id: ownStage.stage_id, p_operation_key: input.operationKey, p_staff_user_id: "staff-254" })
    expect(boundary.remove).not.toHaveBeenCalled()
  })
  it("reuses an already retained exact version without upload or delete even when the command is refused", async () => {
    const rpc = boundary.rpc.getMockImplementation()!
    boundary.rpc.mockImplementation(async (name: string, args: unknown) => name === "journey_stage_external_ldc"
      ? { data: { ...ownStage, retained: true }, error: null } : name === "journey_record_external_handoff" ? { data: null, error: {} } : rpc(name, args))
    expect((await recordExternalPursuitHandoff(e4Input)).success).toBe(false)
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.remove).not.toHaveBeenCalled()
  })
  it("replays the exact committed receipt after source replacement without touching Storage or creating another event", async () => {
    boundary.rpc.mockResolvedValue({ data: "25400000-0000-4000-8000-000000000007", error: null })
    expect((await recordExternalPursuitHandoff(e4Input)).success).toBe(true)
    expect(boundary.download).not.toHaveBeenCalled()
    expect(boundary.upload).not.toHaveBeenCalled()
    expect(boundary.rpc).toHaveBeenCalledTimes(1)
    expect(boundary.provider).not.toHaveBeenCalled()
  })
})
