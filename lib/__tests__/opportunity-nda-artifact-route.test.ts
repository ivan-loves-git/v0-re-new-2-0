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
  privateSignedDownloadContentTypeFromFilename: (value: string | null | undefined) =>
    value?.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/octet-stream",
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

import { GET } from "@/app/(dashboard)/opportunities/[id]/nda-artifacts/[artifactId]/route"

const opportunityId = "018f62b4-6500-7f65-9afb-8f0ea8cd4ba9"
const artifactId = "018f62b4-6500-7f65-9afb-8f0ea8cd4baa"

function setupAdminClient({
  artifact = { document_id: "018f62b4-6500-7f65-9afb-8f0ea8cd4bab" },
  document = {
    storage_bucket: "opportunity-documents",
    storage_path: `${opportunityId}/nda-artifacts/blank_template/blank.pdf`,
    file_name: "blank.pdf",
    mime_type: "application/pdf",
  },
  artifactError = null,
  documentError = null,
  signedUrlError = null,
}: {
  artifact?: { document_id: string } | null
  document?: {
    storage_bucket: string
    storage_path: string | null
    file_name: string
    mime_type?: string | null
  } | null
  artifactError?: { message: string } | null
  documentError?: { message: string } | null
  signedUrlError?: { message: string } | null
} = {}) {
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: artifactError ? null : artifact,
    error: artifactError,
  })
  const artifactOpportunityEq = vi.fn(() => ({
    maybeSingle: artifactMaybeSingle,
  }))
  const artifactIdEq = vi.fn(() => ({ eq: artifactOpportunityEq }))
  const artifactSelect = vi.fn(() => ({ eq: artifactIdEq }))

  const documentMaybeSingle = vi.fn().mockResolvedValue({
    data: documentError ? null : document,
    error: documentError,
  })
  const documentVisibilityEq = vi.fn(() => ({
    maybeSingle: documentMaybeSingle,
  }))
  const documentTypeEq = vi.fn(() => ({ eq: documentVisibilityEq }))
  const documentOpportunityEq = vi.fn(() => ({ eq: documentTypeEq }))
  const documentIdEq = vi.fn(() => ({ eq: documentOpportunityEq }))
  const documentSelect = vi.fn(() => ({ eq: documentIdEq }))

  const createSignedUrl = vi.fn().mockResolvedValue({
    data: signedUrlError ? null : { signedUrl: "https://storage.example.test/signed-nda" },
    error: signedUrlError,
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
  return GET(new Request(`http://localhost/opportunities/${opportunityId}/nda-artifacts/${artifactId}${suffix}`), {
    params: Promise.resolve({
      id: opportunityId,
      artifactId,
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

  it("treats a malformed opportunity or artifact link as not found without loading metadata", async () => {
    setupAdminClient()

    const response = await GET(new Request("http://localhost/opportunities/not-a-uuid/nda-artifacts/not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid", artifactId: "not-a-uuid" }),
    })

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.proxyDownload).not.toHaveBeenCalled()
  })

  it("returns not found when the artifact is outside the opportunity", async () => {
    const { documentSelect, createSignedUrl } = setupAdminClient({
      artifact: null,
    })

    const response = await requestArtifact()
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("streams a retained private PDF without exposing its signed URL", async () => {
    const { createSignedUrl } = setupAdminClient()

    const response = await requestArtifact()

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith(`${opportunityId}/nda-artifacts/blank_template/blank.pdf`, 60)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-nda",
      expect.objectContaining({ disposition: "inline" }),
    )
  })

  it("downloads a retained DOCX with its original file name", async () => {
    const { createSignedUrl } = setupAdminClient({
      document: {
        storage_bucket: "opportunity-documents",
        storage_path: `${opportunityId}/nda-artifacts/blank_template/blank.docx`,
        file_name: "Blank NDA.docx",
      },
    })

    const response = await requestArtifact(true)

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).toHaveBeenCalledWith(`${opportunityId}/nda-artifacts/blank_template/blank.docx`, 60)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-nda",
      expect.objectContaining({ disposition: "attachment" }),
    )
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

  it.each([
    ["artifact metadata", { artifactError: { message: "column internal_artifact_secret missing" } }],
    ["document metadata", { documentError: { message: "permission denied for private_documents" } }],
    ["storage signing", { signedUrlError: { message: "bucket internal-policy rejected request" } }],
  ])("does not expose raw %s errors", async (_scope, errors) => {
    setupAdminClient(errors)

    const response = await requestArtifact()

    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    const body = await response.text()
    expect(body).toContain("Artifact file is unavailable.")
    expect(body).not.toContain("internal_artifact_secret")
    expect(body).not.toContain("private_documents")
    expect(body).not.toContain("internal-policy")
  })
})
