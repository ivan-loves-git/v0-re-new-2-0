import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import {
  deleteExternalPursuitAttachment,
  fulfillExternalPursuitDeletionWithAttachments,
  uploadExternalPursuitAttachment,
} from "@/lib/actions/external-pursuit-attachments"
import { fulfillExternalPursuitDeletion } from "@/lib/actions/external-pursuits"

function validPdf() {
  const header = "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
  return `${header}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${header.length}\n%%EOF\n`
}
const key = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`
function uploadForm(name = "memo.pdf") {
  const form = new FormData()
  form.set("file", new File([validPdf()], name, { type: "application/pdf" }))
  return form
}

describe("External Pursuit attachment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "repreneur", repreneurId: "owner-1", user: { id: "owner-user" } })
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-user" } })
    mocks.upload.mockResolvedValue({ data: {}, error: null })
    mocks.remove.mockResolvedValue({ data: [], error: null })
    mocks.createAdminClient.mockReturnValue({
      rpc: mocks.rpc,
      storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) },
    })
  })

  it("denies an unassigned user before creating a service-role client", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "unassigned", user: { id: "unknown" } })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(1))).resolves.toMatchObject({ success: false })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("cleans only the losing random object when two concurrent calls share one key", async () => {
    let committed: { attachment_id: string; storage_path: string } | null = null
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: null, error: null }
      if (name === "register_external_pursuit_attachment") {
        if (!committed) committed = { attachment_id: "attachment-1", storage_path: args.p_storage_path }
        return { data: committed, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    const results = await Promise.all([
      uploadExternalPursuitAttachment("dossier-1", uploadForm("first.pdf"), key(2)),
      uploadExternalPursuitAttachment("dossier-1", uploadForm("second.pdf"), key(2)),
    ])
    expect(results.every((result) => result.success)).toBe(true)
    const registeredPaths = mocks.rpc.mock.calls.filter(([name]) => name === "register_external_pursuit_attachment").map(([,args]) => args.p_storage_path)
    const winningPath = registeredPaths[0]
    expect(new Set(registeredPaths).size).toBe(2)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledWith([registeredPaths.find((path) => path !== winningPath)])
    expect(mocks.remove).not.toHaveBeenCalledWith([winningPath])
  })

  it("re-queries a lost response after commit and preserves its authoritative object", async () => {
    let committed: { attachment_id: string; storage_path: string } | null = null
    mocks.rpc.mockImplementation(async (name: string, args: Record<string,string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: committed, error: null }
      if (name === "register_external_pursuit_attachment") {
        committed = { attachment_id: "attachment-after-loss", storage_path: args.p_storage_path }
        return { data: null, error: new Error("response lost after commit") }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(3))).resolves.toMatchObject({ success: true, attachmentId: "attachment-after-loss" })
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "external_pursuit_attachment_upload_replay",
      "register_external_pursuit_attachment",
      "external_pursuit_attachment_upload_replay",
    ])
  })

  it("reports failed cleanup when a confirmed uncommitted upload cannot be removed", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "register_external_pursuit_attachment"
      ? { data: null, error: new Error("registration failed") }
      : { data: null, error: null })
    mocks.remove.mockResolvedValue({ data: null, error: new Error("storage unavailable") })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(4))).resolves.toMatchObject({ success: false, message: expect.stringMatching(/cleanup needs staff attention/i) })
  })

  it("stops individual deletion before metadata finalization when object removal fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "dossier-1/object.pdf", error: null })
    mocks.remove.mockResolvedValue({ data: null, error: new Error("storage unavailable") })
    await expect(deleteExternalPursuitAttachment("dossier-1", "attachment-1", key(5))).resolves.toMatchObject({ success: false })
    expect(mocks.rpc).not.toHaveBeenCalledWith("finalize_external_pursuit_attachment_deletion", expect.anything())
  })

  it("stops dossier fulfillment before metadata/tombstone when any object cleanup fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: "attachment-1", storage_path: "dossier-1/object.pdf" }], error: null })
    mocks.remove.mockResolvedValue({ data: null, error: new Error("storage unavailable") })
    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(6))).resolves.toMatchObject({ success: false })
    expect(mocks.rpc).not.toHaveBeenCalledWith("clear_external_pursuit_attachment_records_for_fulfillment", expect.anything())
    expect(mocks.rpc).not.toHaveBeenCalledWith("fulfill_external_pursuit_deletion", expect.anything())
  })

  it("routes the legacy fulfillment action through attachment cleanup before tombstoning", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_attachment_cleanup_for_fulfillment") return { data: [], error: null }
      if (name === "clear_external_pursuit_attachment_records_for_fulfillment") return { data: null, error: null }
      if (name === "fulfill_external_pursuit_deletion") return { data: null, error: null }
      throw new Error(`Unexpected RPC ${name}`)
    })
    await expect(fulfillExternalPursuitDeletion("dossier-1", key(7))).resolves.toMatchObject({ success: true, pursuitId: "dossier-1" })
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "external_pursuit_attachment_cleanup_for_fulfillment",
      "clear_external_pursuit_attachment_records_for_fulfillment",
      "fulfill_external_pursuit_deletion",
    ])
  })
})
