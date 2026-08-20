import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ getCurrentUserAccess: mocks.getCurrentUserAccess }))
vi.mock("@/lib/data/current-pursuit", () => ({
  resolvePortalPursuitResource: mocks.resolvePortalPursuitResource,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from "@/app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route"

function requestPreview() {
  return GET(
    new NextRequest("http://localhost/portal-preview/deals/match-1/documents/memo-1?repreneurId=repreneur-1"),
    { params: Promise.resolve({ matchId: "match-1", documentId: "memo-1" }) },
  )
}

describe("staff portal preview confidential route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetch)
    mocks.fetch.mockResolvedValue(
      new Response("preview memo", {
        headers: { "content-type": "application/pdf" },
      }),
    )
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
  })

  it("fails closed when the preview pursuit lacks an exact canonical IM grant", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    const response = await requestPreview()
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("fails closed when the selected IM differs from the exact grant", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    expect((await requestPreview()).status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("fails closed after a revocation without loading the IM", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    expect((await requestPreview()).status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("uses the exact staff-preview helper scope rather than a raw staff projection", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    await requestPreview()

    expect(mocks.resolvePortalPursuitResource).toHaveBeenCalledWith({
      matchId: "match-1",
      viewer: { kind: "staff-preview", repreneurId: "repreneur-1" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })
  })

  it("proxies an authorized preview memo without exposing its signed storage URL", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId: "memo-1",
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "memo-1",
        document_type: "deal_book",
        external_url: null,
        storage_bucket: "opportunity-documents",
        storage_path: "opportunity-1/documents/memo.pdf",
      },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: {
              signedUrl:
                "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/preview-memo?token=test",
            },
            error: null,
          }),
        })),
      },
    })

    const response = await requestPreview()

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="information-memorandum.pdf"',
    )
    await expect(response.text()).resolves.toBe("preview memo")
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/preview-memo?token=test",
      { cache: "no-store", redirect: "error" },
    )
  })

  it.each([
    ["with a storage path", "opportunity-1/documents/memo.pdf"],
    ["without a storage path", null],
  ])("fails closed for an external preview memo %s", async (_label, storagePath) => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId: "memo-1",
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "memo-1",
        document_type: "deal_book",
        external_url: "https://storage.example.test/legacy-signed-memo",
        storage_bucket: "opportunity-documents",
        storage_path: storagePath,
      },
      error: null,
    })
    const createSignedUrl = vi.fn()
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    })

    const response = await requestPreview()

    expect(response.status).toBe(404)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("does not expose raw document metadata errors", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId: "memo-1",
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "permission denied for private_opportunity_documents" },
    })
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      })),
    })

    const response = await requestPreview()

    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    const body = await response.text()
    expect(body).toContain("Confidential document is unavailable.")
    expect(body).not.toContain("private_opportunity_documents")
  })
})
