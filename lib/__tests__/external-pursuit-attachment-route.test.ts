import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  createSignedUrl: vi.fn(),
  proxyDownload: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ getCurrentUserAccessFromHeaders: mocks.getAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/storage/private-signed-download", () => ({
  proxyPrivateSignedStorageDownload: mocks.proxyDownload,
  privateSignedDownloadContentType: (value: string | null | undefined) => value ?? "application/octet-stream",
  privateSignedDownloadContentTypeFromFilename: () => "application/octet-stream",
  privateStorageDownloadError: (message: string, status = 502) => new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        "cache-control": "private, no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
      },
    },
  ),
}))

import { GET } from "@/app/api/external-pursuits/[pursuitId]/attachments/[attachmentId]/route"

function request() {
  return GET(new Request("http://localhost/api/external-pursuits/dossier-1/attachments/file-1"), {
    params: Promise.resolve({ pursuitId: "dossier-1", attachmentId: "file-1" }),
  })
}

describe("External Pursuit attachment download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAccess.mockResolvedValue({ role: "repreneur", repreneurId: "owner-1", user: { id: "owner-user" } })
    mocks.rpc.mockResolvedValue({ data: [{ storage_path: "dossier-1/random.pdf", original_filename: "Memo.pdf", content_type: "application/pdf" }], error: null })
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example.test/private" }, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc, storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) } })
    mocks.proxyDownload.mockResolvedValue(new Response("attachment", { status: 200 }))
  })

  it("rejects an unassigned session before any service-role lookup", async () => {
    mocks.getAccess.mockResolvedValue({ role: "unassigned", user: { id: "unknown" } })
    const response = await request()
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("does not sign a URL when exact dossier/attachment access is denied", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("External Pursuit access denied.") })
    expect((await request()).status).toBe(404)
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it("streams an attachment after exact authorization without exposing its signed URL", async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(mocks.rpc).toHaveBeenCalledWith("external_pursuit_attachment_for_actor", {
      p_dossier_id: "dossier-1", p_attachment_id: "file-1", p_actor_user_id: "owner-user",
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("dossier-1/random.pdf", 60)
    expect(mocks.proxyDownload).toHaveBeenCalledWith("https://storage.example.test/private", {
      filename: "Memo.pdf",
      contentType: "application/pdf",
    })
  })
})
