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

function validPdf(label = "") {
  const header = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Subject (${label}) >>\nendobj\n`
  return `${header}xref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n${header.length}\n%%EOF\n`
}
const key = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`
function uploadForm(name = "memo.pdf", body = validPdf()) {
  const form = new FormData()
  form.set("file", new File([body], name, { type: "application/pdf" }))
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

  it("rejects a non-canonical upload key before database or storage mutation", async () => {
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), "predictable-key")).resolves.toMatchObject({ success: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it("requires staff authorization before checking a deletion tombstone", async () => {
    mocks.requireStaffAccess.mockRejectedValueOnce(new Error("External Pursuit access denied."))
    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(12))).resolves.toMatchObject({ success: false })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("converges concurrent same-key uploads on one deterministic object and row", async () => {
    const objects = new Set<string>()
    let committed: { attachment_id: string; storage_path: string } | null = null
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: committed, error: null }
      if (name === "register_external_pursuit_attachment") {
        if (!committed) committed = { attachment_id: "attachment-1", storage_path: args.p_storage_path }
        return { data: committed, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    mocks.upload.mockImplementation(async (path: string) => {
      if (objects.has(path)) return { data: null, error: { name: "StorageApiError", status: 409, message: "already exists" } }
      objects.add(path)
      return { data: {}, error: null }
    })
    const results = await Promise.all([
      uploadExternalPursuitAttachment("dossier-1", uploadForm("memo.pdf"), key(2)),
      uploadExternalPursuitAttachment("dossier-1", uploadForm("memo.pdf"), key(2)),
    ])
    expect(results.every((result) => result.success)).toBe(true)
    const registeredPaths = mocks.rpc.mock.calls.filter(([name]) => name === "register_external_pursuit_attachment").map(([,args]) => args.p_storage_path)
    expect(new Set(registeredPaths).size).toBe(1)
    expect(registeredPaths[0]).toMatch(/^dossier-1\/[0-9a-f]{64}\.pdf$/)
    expect(objects.size).toBe(1)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("recovers a lost upload response before registration into one object and row", async () => {
    const objects = new Set<string>()
    let committed: { attachment_id: string; storage_path: string } | null = null
    let loseFirstResponse = true
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: committed, error: null, status: 200 }
      if (name === "register_external_pursuit_attachment") {
        if (!committed) committed = { attachment_id: "attachment-after-upload-loss", storage_path: args.p_storage_path }
        return { data: committed, error: null, status: 200 }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    mocks.upload.mockImplementation(async (path: string) => {
      if (objects.has(path)) return { data: null, error: { name: "StorageApiError", status: 409, message: "already exists" } }
      objects.add(path)
      if (loseFirstResponse) {
        loseFirstResponse = false
        throw { name: "StorageUnknownError", originalError: new TypeError("fetch failed") }
      }
      return { data: {}, error: null }
    })

    const form = uploadForm()
    await expect(uploadExternalPursuitAttachment("dossier-1", form, key(16))).resolves.toMatchObject({ success: false, retryExact: true })
    await expect(uploadExternalPursuitAttachment("dossier-1", form, key(16))).resolves.toMatchObject({ success: true, attachmentId: "attachment-after-upload-loss" })

    expect(new Set(mocks.upload.mock.calls.map(([path]) => path)).size).toBe(1)
    expect(objects.size).toBe(1)
    expect(mocks.rpc.mock.calls.filter(([name]) => name === "register_external_pursuit_attachment")).toHaveLength(1)
  })

  it("does not alias changed bytes or a changed key", async () => {
    const objects = new Set<string>()
    const registrations = new Map<string, { attachment_id: string; storage_path: string }>()
    mocks.upload.mockImplementation(async (path: string) => {
      if (objects.has(path)) return { data: null, error: { name: "StorageApiError", status: 409, message: "already exists" } }
      objects.add(path)
      return { data: {}, error: null }
    })
    mocks.remove.mockImplementation(async (paths: string[]) => {
      paths.forEach((path) => objects.delete(path))
      return { data: [], error: null }
    })
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: registrations.get(args.p_idempotency_key) ?? null, error: null }
      if (name === "register_external_pursuit_attachment") {
        const registration = registrations.get(args.p_idempotency_key) ?? {
          attachment_id: `attachment-${registrations.size + 1}`,
          storage_path: args.p_storage_path,
        }
        registrations.set(args.p_idempotency_key, registration)
        return { data: registration, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm("memo.pdf", validPdf("A")), key(17))).resolves.toMatchObject({ success: true })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm("renamed.pdf", validPdf("A")), key(17))).resolves.toMatchObject({ success: false, retryExact: false, message: expect.stringMatching(/different file/i) })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm("memo.pdf", validPdf("B")), key(17))).resolves.toMatchObject({ success: false, retryExact: false, message: expect.stringMatching(/different file/i) })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm("memo.pdf", validPdf("A")), key(18))).resolves.toMatchObject({ success: true })

    expect(registrations.size).toBe(2)
    expect(new Set([...registrations.values()].map(({ storage_path }) => storage_path)).size).toBe(2)
    expect(objects.size).toBe(2)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("does not alias the same dossier, key and file across authorized actors", async () => {
    const registeredPaths: string[] = []
    mocks.rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "external_pursuit_attachment_upload_replay") return { data: null, error: null }
      if (name === "register_external_pursuit_attachment") {
        registeredPaths.push(args.p_storage_path)
        return { data: { attachment_id: `attachment-${registeredPaths.length}`, storage_path: args.p_storage_path }, error: null }
      }
      throw new Error(`Unexpected RPC ${name}`)
    })

    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(19))).resolves.toMatchObject({ success: true })
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "staff", user: { id: "staff-user" } })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(19))).resolves.toMatchObject({ success: true })

    expect(registeredPaths).toHaveLength(2)
    expect(new Set(registeredPaths).size).toBe(2)
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
    mocks.remove.mockResolvedValue({ data: null, error: { name: "StorageApiError", status: 500, message: "storage unavailable" } })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(4))).resolves.toMatchObject({ success: false, retryExact: false, message: expect.stringMatching(/cleanup needs staff attention/i) })
  })

  it("retains exact recovery for ambiguous deterministic losing-path cleanup", async () => {
    const committed = { attachment_id: "attachment-winner", storage_path: `dossier-1/${"a".repeat(64)}.pdf` }
    let replayCalls = 0
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_attachment_upload_replay") {
        replayCalls += 1
        return { data: replayCalls === 1 ? null : committed, error: null }
      }
      if (name === "register_external_pursuit_attachment") return {
        data: committed,
        error: null,
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    mocks.remove
      .mockRejectedValueOnce({ name: "StorageUnknownError", originalError: new TypeError("fetch failed") })
      .mockResolvedValueOnce({ data: null, error: { name: "StorageApiError", status: 404, message: "not found" } })

    const form = uploadForm()
    await expect(uploadExternalPursuitAttachment("dossier-1", form, key(14))).resolves.toMatchObject({
      success: false,
      retryExact: true,
      message: expect.stringMatching(/cleanup was not confirmed/i),
    })
    await expect(uploadExternalPursuitAttachment("dossier-1", form, key(14), true)).resolves.toMatchObject({ success: false, retryExact: false })
    expect(mocks.remove).toHaveBeenCalledTimes(2)
    expect(mocks.remove.mock.calls[0][0]).toEqual(mocks.remove.mock.calls[1][0])
  })

  it("stops individual deletion before metadata finalization when object removal fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "dossier-1/object.pdf", error: null })
    mocks.remove.mockResolvedValue({ data: null, error: new Error("storage unavailable") })
    await expect(deleteExternalPursuitAttachment("dossier-1", "attachment-1", key(5))).resolves.toMatchObject({ success: false, retryExact: true })
    expect(mocks.rpc).not.toHaveBeenCalledWith("finalize_external_pursuit_attachment_deletion", expect.anything())
  })

  it("marks a lost initial replay response for the same upload key", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("fetch failed"), status: 0 })
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(8))).resolves.toMatchObject({
      success: false,
      retryExact: true,
    })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it("unlocks after confirmed storage 4xx failures and retains exact recovery only for transport ambiguity", async () => {
    const structuredStorageError = { name: "StorageApiError", status: 400, statusCode: "400", message: "invalid request" }
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    mocks.upload.mockRejectedValueOnce(structuredStorageError)
    await expect(uploadExternalPursuitAttachment("dossier-1", uploadForm(), key(8))).resolves.toMatchObject({ success: false, retryExact: false })

    mocks.rpc.mockResolvedValueOnce({ data: "dossier-1/object.pdf", error: null })
    mocks.remove.mockResolvedValueOnce({ data: null, error: { ...structuredStorageError, status: 404, statusCode: "404" } })
    await expect(deleteExternalPursuitAttachment("dossier-1", "attachment-1", key(9))).resolves.toMatchObject({ success: false, retryExact: false })

    mocks.rpc.mockResolvedValueOnce({ data: "dossier-1/object.pdf", error: null })
    mocks.remove.mockResolvedValueOnce({ data: null, error: { name: "StorageUnknownError", originalError: new TypeError("fetch failed") } })
    await expect(deleteExternalPursuitAttachment("dossier-1", "attachment-1", key(10))).resolves.toMatchObject({ success: false, retryExact: true })
  })

  it("stops dossier fulfillment before metadata/tombstone when any object cleanup fails", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_deletion_fulfillment_replay") return { data: false, error: null }
      if (name === "external_pursuit_attachment_cleanup_for_fulfillment") return { data: [{ id: "attachment-1", storage_path: "dossier-1/object.pdf" }], error: null }
      throw new Error(`Unexpected RPC ${name}`)
    })
    mocks.remove.mockResolvedValue({ data: null, error: new Error("storage unavailable") })
    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(6))).resolves.toMatchObject({ success: false })
    expect(mocks.rpc).not.toHaveBeenCalledWith("clear_external_pursuit_attachment_records_for_fulfillment", expect.anything())
    expect(mocks.rpc).not.toHaveBeenCalledWith("fulfill_external_pursuit_deletion", expect.anything())
  })

  it("unlocks dossier fulfillment after a confirmed storage 4xx without clearing metadata", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_deletion_fulfillment_replay") return { data: false, error: null, status: 200 }
      if (name === "external_pursuit_attachment_cleanup_for_fulfillment") return {
        data: [{ id: "attachment-1", storage_path: "dossier-1/object.pdf" }],
        error: null,
        status: 200,
      }
      throw new Error(`Unexpected RPC ${name}`)
    })
    mocks.remove.mockRejectedValueOnce({ name: "StorageApiError", status: 403, message: "forbidden" })

    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(15))).resolves.toMatchObject({
      success: false,
      retryExact: false,
    })
    expect(mocks.rpc).not.toHaveBeenCalledWith("clear_external_pursuit_attachment_records_for_fulfillment", expect.anything())
    expect(mocks.rpc).not.toHaveBeenCalledWith("fulfill_external_pursuit_deletion", expect.anything())
  })

  it("recovers a lost final fulfillment response from the exact tombstone before live preflight", async () => {
    let replayCalls = 0
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_deletion_fulfillment_replay") {
        replayCalls += 1
        if (replayCalls === 1) return { data: false, error: null, status: 200 }
        if (replayCalls === 2) return { data: null, error: new Error("replay transport lost"), status: 0 }
        return { data: true, error: null, status: 200 }
      }
      if (name === "external_pursuit_attachment_cleanup_for_fulfillment") return { data: [], error: null, status: 200 }
      if (name === "clear_external_pursuit_attachment_records_for_fulfillment") return { data: null, error: null, status: 200 }
      if (name === "fulfill_external_pursuit_deletion") return { data: null, error: new Error("final response lost"), status: 0 }
      throw new Error(`Unexpected RPC ${name}`)
    })

    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(11))).resolves.toMatchObject({ success: false, retryExact: true })
    const beforeRetry = mocks.rpc.mock.calls.length
    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(11))).resolves.toMatchObject({ success: true })
    expect(mocks.rpc.mock.calls.slice(beforeRetry).map(([name]) => name)).toEqual([
      "external_pursuit_deletion_fulfillment_replay",
    ])
  })

  it("does not inspect a live dossier after a mismatched tombstone key", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("External Pursuit deletion fulfillment idempotency conflict."),
      status: 409,
    })
    await expect(fulfillExternalPursuitDeletionWithAttachments("dossier-1", key(13))).resolves.toMatchObject({ success: false, retryExact: false })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("routes the legacy fulfillment action through attachment cleanup before tombstoning", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "external_pursuit_deletion_fulfillment_replay") return { data: false, error: null }
      if (name === "external_pursuit_attachment_cleanup_for_fulfillment") return { data: [], error: null }
      if (name === "clear_external_pursuit_attachment_records_for_fulfillment") return { data: null, error: null }
      if (name === "fulfill_external_pursuit_deletion") return { data: null, error: null }
      throw new Error(`Unexpected RPC ${name}`)
    })
    await expect(fulfillExternalPursuitDeletion("dossier-1", key(7))).resolves.toMatchObject({ success: true, pursuitId: "dossier-1" })
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "external_pursuit_deletion_fulfillment_replay",
      "external_pursuit_attachment_cleanup_for_fulfillment",
      "clear_external_pursuit_attachment_records_for_fulfillment",
      "fulfill_external_pursuit_deletion",
    ])
  })
})
