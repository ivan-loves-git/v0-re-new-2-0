import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { syntheticPdfBytes } from "./fixtures/synthetic-pdf"
const boundary = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), download: vi.fn(), storage: vi.fn() }))
vi.mock("@/lib/access-control", () => ({ getCurrentUserAccess: boundary.access }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: boundary.rpc, storage: { from: boundary.storage } }) }))
import { GET } from "@/app/api/pursuit-handoffs/[id]/ldc/route"
import { loadVerifiedExternalHandoffContext } from "@/lib/external-ldc-version"
const id = "25400000-0000-4000-8000-000000000030", bytes = syntheticPdfBytes(1)
const hash = createHash("sha256").update(bytes).digest("hex")
const storagePath = "pursuit-ldc-evidence/25400000-0000-4000-8000-000000000031/ldc/25400000-0000-4000-8000-000000000032/25400000-0000-4000-8000-000000000033.pdf"
const invoke = () => GET(new Request(`https://synthetic.invalid/api/pursuit-handoffs/${id}/ldc?download`), { params: Promise.resolve({ id }) })
beforeEach(() => {
  vi.clearAllMocks()
  boundary.access.mockResolvedValue({ role: "staff", user: { id: "staff-254", email: "staff@example.test" } })
  boundary.rpc.mockResolvedValue({ data: { storage_path: storagePath, content_sha256: hash, size_bytes: bytes.byteLength }, error: null })
  boundary.storage.mockReturnValue({ download: boundary.download })
  boundary.download.mockResolvedValue({ data: new Blob([Uint8Array.from(bytes)]), error: null })
})
describe("exact privately retained E4 LDC retrieval", () => {
  it("requires authentication before database or Storage reads", async () => {
    boundary.access.mockResolvedValue(null)
    const response = await invoke()
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(boundary.rpc).not.toHaveBeenCalled()
    expect(boundary.storage).not.toHaveBeenCalled()
  })
  it("passes the authenticated owner to canonical authorization and denies an unavailable version before reading bytes", async () => {
    boundary.access.mockResolvedValue({ role: "repreneur", repreneurId: id, user: { id: "owner-254", email: "owner@example.test" } })
    boundary.rpc.mockResolvedValue({ data: null, error: null })
    const response = await invoke()
    expect(response.status).toBe(404)
    expect(boundary.rpc).toHaveBeenCalledWith("journey_retained_ldc_for_actor", { p_receipt_id: id, p_actor_user_id: "owner-254", p_actor_email: "owner@example.test" })
    expect(boundary.storage).not.toHaveBeenCalled()
  })
  it("streams only the exact private receipt PDF without a URL capability, after source replacement", async () => {
    const response = await invoke()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Lettre-de-cadrage.pdf"')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(boundary.download).toHaveBeenCalledWith(storagePath)
  })
  it.each([null, "changed retained bytes"])("fails closed on missing or changed retained bytes (%s)", async (content) => {
    boundary.download.mockResolvedValue({ data: content === null ? null : new Blob([content]), error: null })
    const response = await invoke()
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("changed retained bytes")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
})
describe("offering an external E4 is a current actual-PDF read, never a write", () => {
  const context = { handoff_type: "e4", repreneur_id: id, ldc: { source_object_id: id, source_version: "current-version", source_updated_at: "2026-10-07T12:00:00Z", source_path: `cvs/${id}/ldc/current.pdf`, file_name: "Current Lettre-de-cadrage.pdf", mime_type: "application/pdf", size_bytes: bytes.byteLength, content_sha256: null } }
  it("binds the actual current PDF hash for the staff dialog without staging a copy", async () => {
    boundary.rpc.mockResolvedValue({ data: context, error: null })
    const db = { rpc: boundary.rpc, storage: { from: boundary.storage } }
    const result = await loadVerifiedExternalHandoffContext(db as never, id, "e4")
    expect(result).toEqual({ ...context, ldc: { ...context.ldc, content_sha256: hash } })
    expect(boundary.rpc).toHaveBeenCalledExactlyOnceWith("journey_external_handoff_context", { p_match_id: id, p_handoff_type: "e4" })
  })
  it("hides the control when current metadata claims PDF but stored bytes are not PDF", async () => {
    boundary.rpc.mockResolvedValue({ data: { ...context, ldc: { ...context.ldc, size_bytes: 4 } }, error: null })
    boundary.download.mockResolvedValue({ data: new Blob(["Word"]), error: null })
    expect(await loadVerifiedExternalHandoffContext({ rpc: boundary.rpc, storage: { from: boundary.storage } } as never, id, "e4")).toBeNull()
    expect(boundary.rpc).toHaveBeenCalledTimes(1)
  })
})
