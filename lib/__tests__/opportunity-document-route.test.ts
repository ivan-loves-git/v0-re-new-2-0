import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  proxyDownload: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/storage/private-signed-download", () => ({
  proxyPrivateSignedStorageDownload: mocks.proxyDownload,
  privateSignedDownloadContentType: (value: string | null | undefined) => value ?? "application/octet-stream",
  privateStorageDownloadError: (message: string) => new Response(JSON.stringify({ error: message }), { status: 502 }),
}))

import { GET } from "@/app/(dashboard)/opportunities/[id]/documents/[documentId]/route"

function setupAdminClient(document: {
  storage_bucket: string
  storage_path: string | null
  file_name?: string | null
  mime_type?: string | null
} | null = {
  storage_bucket: "opportunity-documents",
  storage_path: "opportunity-1/documents/memo.pdf",
  file_name: "memo.pdf",
  mime_type: "application/pdf",
}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: document, error: null })
  const opportunityEq = vi.fn(() => ({ maybeSingle }))
  const idEq = vi.fn(() => ({ eq: opportunityEq }))
  const select = vi.fn(() => ({ eq: idEq }))
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example.test/signed-document" },
    error: null,
  })
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn(() => ({ select })),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  })
  return { createSignedUrl, select }
}

function requestDocument(id = "document-1") {
  return GET(new Request(`http://localhost/opportunities/opportunity-1/documents/${id}`), {
    params: Promise.resolve({ id: "opportunity-1", documentId: id }),
  })
}

describe("staff opportunity document route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
    mocks.proxyDownload.mockResolvedValue(new Response("document", { status: 200 }))
  })

  it("requires staff before loading private document metadata", async () => {
    setupAdminClient()
    await requestDocument()
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
  })

  it("does not sign a document outside the requested opportunity", async () => {
    const { createSignedUrl } = setupAdminClient(null)
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("streams the verified document without exposing a signed storage capability", async () => {
    const { createSignedUrl } = setupAdminClient()
    const response = await requestDocument()
    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith("opportunity-1/documents/memo.pdf", 60)
    expect(mocks.proxyDownload).toHaveBeenCalledWith("https://storage.example.test/signed-document", {
      filename: "memo.pdf",
      contentType: "application/pdf",
    })
  })

  it("does not create a storage URL when the private file is unavailable", async () => {
    const { createSignedUrl } = setupAdminClient({
      storage_bucket: "opportunity-documents",
      storage_path: null,
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("rejects a document stored outside the private opportunity bucket", async () => {
    const { createSignedUrl } = setupAdminClient({
      storage_bucket: "other-bucket",
      storage_path: "opportunity-1/documents/memo.pdf",
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("rejects a document path outside the exact opportunity prefix", async () => {
    const { createSignedUrl } = setupAdminClient({
      storage_bucket: "opportunity-documents",
      storage_path: "opportunity-10/documents/memo.pdf",
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
