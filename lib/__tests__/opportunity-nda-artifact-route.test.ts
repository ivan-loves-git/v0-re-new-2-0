import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  proxyDownload: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/storage/private-signed-download", () => ({
  proxyPrivateSignedStorageDownload: mocks.proxyDownload,
  privateSignedDownloadContentType: (value: string | null | undefined) => value ?? "application/octet-stream",
  privateStorageDownloadError: (message: string) => new Response(JSON.stringify({ error: message }), { status: 502 }),
}))

import { GET } from "@/app/(dashboard)/opportunities/[id]/nda-artifacts/[artifactId]/route"

function setupAdminClient({
  artifact = { document_id: "document-1" },
  document = {
    storage_bucket: "opportunity-documents",
    storage_path: "opportunity-1/nda-artifacts/blank_template/blank.pdf",
    file_name: "blank.pdf",
    mime_type: "application/pdf",
  },
}: {
  artifact?: { document_id: string } | null
  document?: {
    storage_bucket: string
    storage_path: string | null
    file_name: string
    mime_type?: string | null
  } | null
} = {}) {
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: artifact,
    error: null,
  })
  const artifactOpportunityEq = vi.fn(() => ({
    maybeSingle: artifactMaybeSingle,
  }))
  const artifactIdEq = vi.fn(() => ({ eq: artifactOpportunityEq }))
  const artifactSelect = vi.fn(() => ({ eq: artifactIdEq }))

  const documentMaybeSingle = vi.fn().mockResolvedValue({
    data: document,
    error: null,
  })
  const documentVisibilityEq = vi.fn(() => ({
    maybeSingle: documentMaybeSingle,
  }))
  const documentTypeEq = vi.fn(() => ({ eq: documentVisibilityEq }))
  const documentOpportunityEq = vi.fn(() => ({ eq: documentTypeEq }))
  const documentIdEq = vi.fn(() => ({ eq: documentOpportunityEq }))
  const documentSelect = vi.fn(() => ({ eq: documentIdEq }))

  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example.test/signed-nda" },
    error: null,
  })

  mocks.createAdminClient.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "opportunity_nda_artifacts") {
        return { select: artifactSelect }
      }
      if (table === "opportunity_documents") {
        return { select: documentSelect }
      }
      throw new Error(`Unexpected table: ${table}`)
    }),
    storage: {
      from: vi.fn(() => ({ createSignedUrl })),
    },
  })

  return { createSignedUrl, documentSelect }
}

function requestArtifact(download = false) {
  const suffix = download ? "?download" : ""
  return GET(new Request(`http://localhost/opportunities/opportunity-1/nda-artifacts/artifact-1${suffix}`), {
    params: Promise.resolve({
      id: "opportunity-1",
      artifactId: "artifact-1",
    }),
  })
}

describe("staff NDA artifact route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({
      role: "staff",
      user: { id: "staff-1", email: "staff@example.test" },
    })
    mocks.proxyDownload.mockResolvedValue(new Response("document", { status: 200 }))
  })

  it("requires staff before reading canonical artifact metadata", async () => {
    setupAdminClient()

    await requestArtifact()

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
  })

  it("returns not found when the artifact is outside the opportunity", async () => {
    const { documentSelect, createSignedUrl } = setupAdminClient({
      artifact: null,
    })

    expect((await requestArtifact()).status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("streams a retained private PDF without exposing its signed URL", async () => {
    const { createSignedUrl } = setupAdminClient()

    const response = await requestArtifact()

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith("opportunity-1/nda-artifacts/blank_template/blank.pdf", 60)
  })

  it("downloads a retained DOCX with its original file name", async () => {
    const { createSignedUrl } = setupAdminClient({
      document: {
        storage_bucket: "opportunity-documents",
        storage_path: "opportunity-1/nda-artifacts/blank_template/blank.docx",
        file_name: "Blank NDA.docx",
      },
    })

    const response = await requestArtifact(true)

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith("opportunity-1/nda-artifacts/blank_template/blank.docx", 60)
  })

  it("refuses a canonical artifact without retained private storage", async () => {
    const { createSignedUrl } = setupAdminClient({
      document: {
        storage_bucket: "opportunity-documents",
        storage_path: null,
        file_name: "blank.pdf",
      },
    })

    expect((await requestArtifact()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
