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

import { GET } from "@/app/(dashboard)/opportunities/[id]/documents/[documentId]/route"

const opportunityId = "018f62b4-6500-7f65-9afb-8f0ea8cd4ba9"
const documentId = "018f62b4-6500-7f65-9afb-8f0ea8cd4baa"

function setupAdminClient(document: {
  storage_bucket: string
  storage_path: string | null
  file_name?: string | null
  mime_type?: string | null
} | null = {
  storage_bucket: "opportunity-documents",
  storage_path: `${opportunityId}/documents/memo.pdf`,
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

function requestDocument(id = documentId, download = false) {
  const query = download ? "?download" : ""
  return GET(new Request(`http://localhost/opportunities/${opportunityId}/documents/${id}${query}`), {
    params: Promise.resolve({ id: opportunityId, documentId: id }),
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

  it("treats a malformed opportunity or document link as not found without querying storage", async () => {
    setupAdminClient()
    const response = await GET(new Request("http://localhost/opportunities/not-a-uuid/documents/not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid", documentId: "not-a-uuid" }),
    })

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.proxyDownload).not.toHaveBeenCalled()
  })

  it("does not sign a document outside the requested opportunity", async () => {
    const { createSignedUrl } = setupAdminClient(null)
    const response = await requestDocument()
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("streams the verified document without exposing a signed storage capability", async () => {
    const { createSignedUrl } = setupAdminClient()
    const response = await requestDocument()
    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith(`${opportunityId}/documents/memo.pdf`, 60)
    expect(mocks.proxyDownload).toHaveBeenCalledWith("https://storage.example.test/signed-document", {
      filename: "memo.pdf",
      contentType: "application/pdf",
      disposition: "inline",
    })
  })

  it("keeps the explicit download action as an attachment", async () => {
    setupAdminClient()

    expect((await requestDocument(documentId, true)).status).toBe(200)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-document",
      {
        filename: "memo.pdf",
        contentType: "application/pdf",
        disposition: "attachment",
      },
    )
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
      storage_path: `${opportunityId}/documents/memo.pdf`,
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("rejects a document path outside the exact opportunity prefix", async () => {
    const { createSignedUrl } = setupAdminClient({
      storage_bucket: "opportunity-documents",
      storage_path: "018f62b4-6500-7f65-9afb-8f0ea8cd4bab/documents/memo.pdf",
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
