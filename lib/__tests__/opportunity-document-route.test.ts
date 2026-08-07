import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from "@/app/(dashboard)/opportunities/[id]/documents/[documentId]/route"

function setupAdminClient(document: {
  storage_bucket: string
  storage_path: string | null
  external_url: string | null
} | null = {
  storage_bucket: "opportunity-documents",
  storage_path: "opportunity-1/documents/memo.pdf",
  external_url: null,
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

  it("returns a private, short-lived signed URL for the verified document", async () => {
    const { createSignedUrl } = setupAdminClient()
    const response = await requestDocument()
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-document")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(createSignedUrl).toHaveBeenCalledWith("opportunity-1/documents/memo.pdf", 60)
  })

  it("does not create a storage URL when the private file is unavailable", async () => {
    const { createSignedUrl } = setupAdminClient({
      storage_bucket: "opportunity-documents",
      storage_path: null,
      external_url: null,
    })
    expect((await requestDocument()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
