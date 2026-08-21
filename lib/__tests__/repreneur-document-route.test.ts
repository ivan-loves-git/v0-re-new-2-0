import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCurrentUserAccess: vi.fn(),
  proxyDownload: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/storage/private-signed-download", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/storage/private-signed-download")>(),
  proxyPrivateSignedStorageDownload: mocks.proxyDownload,
}))

import { GET } from "@/app/api/repreneurs/[id]/documents/[documentType]/route"

const REPRENEUR_ID = "11111111-1111-4111-8111-111111111111"
const ANOTHER_REPRENEUR_ID = "22222222-2222-4222-8222-222222222222"

const STAFF_ACCESS = {
  role: "staff",
  repreneurId: null,
  repreneurName: null,
  user: { id: "qa-staff" },
}

const REPRENEUR_ACCESS = {
  role: "repreneur",
  repreneurId: REPRENEUR_ID,
  repreneurName: "Fixture Repreneur",
  user: { id: "qa-repreneur" },
}

function setupAdminClient(
  repreneur: { cv_url: string | null; ldc_url: string | null } | null,
) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: repreneur, error: null })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const databaseFrom = vi.fn(() => ({ select }))
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example.test/signed-document" },
    error: null,
  })
  const storageFrom = vi.fn(() => ({ createSignedUrl }))

  mocks.createAdminClient.mockReturnValue({
    from: databaseFrom,
    storage: { from: storageFrom },
  })

  return { createSignedUrl, eq }
}

function requestFor(id: string, documentType: string, query = "") {
  return GET(
    new NextRequest(
      `http://localhost/api/repreneurs/${id}/documents/${documentType}${query}`,
    ),
    { params: Promise.resolve({ id, documentType }) },
  )
}

describe("repreneur document route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.proxyDownload.mockResolvedValue(new Response("document", { status: 200 }))
  })

  it("rejects unauthenticated sessions before loading metadata", async () => {
    mocks.getCurrentUserAccess.mockResolvedValueOnce(null)
    const response = await requestFor("fixture", "cv")
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")

    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("treats a malformed repreneur URL as not found before querying document metadata", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF_ACCESS)

    const response = await requestFor("not-a-uuid", "cv")

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("lets a repreneur open their own Lettre de cadrage", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(REPRENEUR_ACCESS)
    const { createSignedUrl, eq } = setupAdminClient({
      cv_url: "cvs/fixture-cv.pdf",
      ldc_url: "cvs/fixture-ldc.pdf",
    })

    const response = await requestFor(REPRENEUR_ID, "ldc")

    expect(eq).toHaveBeenCalledWith("id", REPRENEUR_ID)
    expect(createSignedUrl).toHaveBeenCalledWith("cvs/fixture-ldc.pdf", 60)
    expect(response.status).toBe(200)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-document",
      expect.objectContaining({ disposition: "inline" }),
    )
  })

  it("does not expose another repreneur's Lettre de cadrage", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(REPRENEUR_ACCESS)

    expect((await requestFor(ANOTHER_REPRENEUR_ID, "ldc")).status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("keeps CV documents staff-only even for the owning repreneur", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(REPRENEUR_ACCESS)

    expect((await requestFor(REPRENEUR_ID, "cv")).status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects unassigned and unlinked repreneur sessions", async () => {
    mocks.getCurrentUserAccess.mockResolvedValueOnce({
      ...REPRENEUR_ACCESS,
      role: "unassigned",
      repreneurId: null,
    })
    expect((await requestFor(REPRENEUR_ID, "ldc")).status).toBe(403)

    mocks.getCurrentUserAccess.mockResolvedValueOnce({
      ...REPRENEUR_ACCESS,
      role: "repreneur",
      repreneurId: null,
    })
    expect((await requestFor(REPRENEUR_ID, "ldc")).status).toBe(403)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("signs the document selected from the requested repreneur record", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF_ACCESS)
    const { createSignedUrl, eq } = setupAdminClient({
      cv_url:
        "https://project.supabase.co/storage/v1/object/public/cvs/cvs/fixture-b-cv.pdf",
      ldc_url: null,
    })

    const response = await requestFor(
      ANOTHER_REPRENEUR_ID,
      "cv",
      "?path=cvs/fixture-a-cv.pdf",
    )

    expect(eq).toHaveBeenCalledWith("id", ANOTHER_REPRENEUR_ID)
    expect(createSignedUrl).toHaveBeenCalledWith("cvs/fixture-b-cv.pdf", 60)
    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  it("creates a forced-download signed URL with a clean filename", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF_ACCESS)
    const { createSignedUrl } = setupAdminClient({
      cv_url: null,
      ldc_url: "cvs/fixture-ldc.docx",
    })

    const response = await requestFor(REPRENEUR_ID, "ldc", "?download")

    expect(createSignedUrl).toHaveBeenCalledWith("cvs/fixture-ldc.docx", 60)
    expect(response.status).toBe(200)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-document",
      expect.objectContaining({ disposition: "attachment" }),
    )
  })

  it("streams a legacy Word document with its actual safe content type", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF_ACCESS)
    setupAdminClient({
      cv_url: "cvs/fixture-cv.doc",
      ldc_url: null,
    })

    const response = await requestFor(REPRENEUR_ID, "cv")

    expect(response.status).toBe(200)
    expect(mocks.proxyDownload).toHaveBeenCalledWith(
      "https://storage.example.test/signed-document",
      {
        filename: "CV.doc",
        contentType: "application/msword",
        disposition: "inline",
      },
    )
  })

  it("returns a clean not-found response for missing or invalid metadata", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue(STAFF_ACCESS)
    const missing = setupAdminClient({ cv_url: null, ldc_url: null })
    expect((await requestFor(REPRENEUR_ID, "cv")).status).toBe(404)
    expect(missing.createSignedUrl).not.toHaveBeenCalled()

    const invalid = setupAdminClient({
      cv_url: "/api/repreneurs/fixture/documents/cv",
      ldc_url: null,
    })
    expect((await requestFor(REPRENEUR_ID, "cv")).status).toBe(404)
    expect(invalid.createSignedUrl).not.toHaveBeenCalled()
  })
})
