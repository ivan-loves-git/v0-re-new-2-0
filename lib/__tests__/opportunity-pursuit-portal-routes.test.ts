import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/data/current-pursuit", () => ({
  resolvePortalPursuitResource: mocks.resolvePortalPursuitResource,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET as getInformationMemo } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"
import { GET as getTemplate } from "@/app/portal/deals/[matchId]/nda-template/route"

describe("canonical portal pursuit routes", () => {
  beforeEach(() => vi.clearAllMocks())

  function setupTemplateDownload() {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/current-template" },
      error: null,
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
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("denies a different IM even where another exact grant exists", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    const response = await getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-other"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-other" }) },
    )

    expect(response.status).toBe(404)
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

  it("signs only the exact template returned by the canonical active-pursuit resolver", async () => {
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

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.test/current-template")
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
  })
})
