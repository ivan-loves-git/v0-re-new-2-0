import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
  fetch: vi.fn(),
  startCriticalOperation: vi.fn(),
  traceFailure: vi.fn(),
  traceSuccess: vi.fn(),
  unstableRethrow: vi.fn(),
}))

vi.mock("@/lib/data/current-pursuit", () => ({
  resolvePortalPursuitResource: mocks.resolvePortalPursuitResource,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: mocks.startCriticalOperation,
}))
vi.mock("next/navigation", () => ({ unstable_rethrow: mocks.unstableRethrow }))

import { GET as getInformationMemo } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"
import { GET as getTemplate } from "@/app/portal/deals/[matchId]/nda-template/route"

describe("canonical portal pursuit routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startCriticalOperation.mockReturnValue({
      failure: mocks.traceFailure,
      success: mocks.traceSuccess,
    })
    mocks.unstableRethrow.mockImplementation((error: unknown) => {
      throw error
    })
    vi.stubGlobal("fetch", mocks.fetch)
    mocks.fetch.mockResolvedValue(
      new Response("template bytes", {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": 'attachment; filename="template.docx"',
        },
      }),
    )
  })

  function setupTemplateDownload(
    result: { data: { signedUrl: string } | null; error: { message: string } | null } = {
      data: {
        signedUrl:
          "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/current-template?token=test",
      },
      error: null,
    },
  ) {
    const createSignedUrl = vi.fn().mockResolvedValue({
      ...result,
    })
    const storageFrom = vi.fn(() => ({ createSignedUrl }))
    mocks.createAdminClient.mockReturnValue({ storage: { from: storageFrom } })
    return { createSignedUrl, storageFrom }
  }

  it("fails closed for an IM without an exact canonical grant", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    const response = await getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-1"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-1" }) },
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rethrows portal redirect control flow without recording an internal failure", async () => {
    const redirect = new Error("NEXT_REDIRECT")
    mocks.resolvePortalPursuitResource.mockRejectedValue(redirect)

    await expect(getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-1"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-1" }) },
    )).rejects.toBe(redirect)

    expect(mocks.unstableRethrow).toHaveBeenCalledWith(redirect)
    expect(mocks.traceFailure).not.toHaveBeenCalled()
  })

  it("denies a different IM even where another exact grant exists", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    const response = await getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-other"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-other" }) },
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("denies the template when the active-pursuit Gate 1 resolver returns no exact document", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("proxies only the exact template returned by the canonical active-pursuit resolver", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "nda-template",
      documentId: "template-document-v2",
      storageBucket: "opportunity-documents",
      storagePath: "opportunity-1/nda-artifacts/blank_template/template-v2.docx",
    })
    const { createSignedUrl, storageFrom } = setupTemplateDownload()

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="nda-template.docx"',
    )
    await expect(response.text()).resolves.toBe("template bytes")
    expect(mocks.resolvePortalPursuitResource).toHaveBeenCalledWith({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "nda-template" },
    })
    expect(storageFrom).toHaveBeenCalledWith("opportunity-documents")
    expect(createSignedUrl).toHaveBeenCalledWith(
      "opportunity-1/nda-artifacts/blank_template/template-v2.docx",
      60,
      { download: true },
    )
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/current-template?token=test",
      { cache: "no-store", redirect: "error" },
    )
  })

  it("streams a canonical PDF template as an attachment", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "nda-template",
      documentId: "template-document-pdf",
      storageBucket: "opportunity-documents",
      storagePath: "opportunity-1/nda-artifacts/blank_template/template.pdf",
    })
    mocks.fetch.mockResolvedValueOnce(
      new Response("pdf bytes", { headers: { "content-type": "application/pdf" } }),
    )
    setupTemplateDownload()

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="nda-template.pdf"',
    )
    await expect(response.text()).resolves.toBe("pdf bytes")
  })

  it("does not expose signing failures from private template storage", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "nda-template",
      documentId: "template-document-v2",
      storageBucket: "opportunity-documents",
      storagePath: "opportunity-1/nda-artifacts/blank_template/template-v2.docx",
    })
    setupTemplateDownload({
      data: null,
      error: { message: "storage credentials must remain private" },
    })

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(502)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    await expect(response.json()).resolves.toEqual({
      error: "Template file is unavailable.",
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
