import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
  fetch: vi.fn(),
  selectionToken: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ getCurrentUserAccess: mocks.getCurrentUserAccess }))
vi.mock("@/lib/recipient-im-download-lock", () => ({ withRecipientImPursuitLock: async (_matchId: string, work: () => Promise<Response>) => work() }))
vi.mock("@/lib/data/current-pursuit", () => ({
  resolvePortalPursuitResource: mocks.resolvePortalPursuitResource,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/staff-portal-selection", () => ({ isCurrentStaffPortalSelectionGeneration: mocks.selectionToken }))

import { GET } from "@/app/(dashboard)/portal-preview/deals/[matchId]/documents/[documentId]/route"

const workspaceId = "00000000-0000-4000-8000-000000000003"
const ownerId = "00000000-0000-4000-8000-000000000001"
const matchId = "00000000-0000-4000-8000-000000000002"
const documentId = "00000000-0000-4000-8000-000000000005"
const generationA = "00000000-0000-4000-8000-000000000006"
const generationB = "00000000-0000-4000-8000-000000000007"
const generationC = "00000000-0000-4000-8000-000000000008"

function requestPreview(generation = generationA) {
  return GET(
    new NextRequest(`http://localhost/portal-preview/deals/${matchId}/documents/${documentId}?repreneurId=${ownerId}&workspaceId=${workspaceId}&selectionGeneration=${generation}`),
    { params: Promise.resolve({ matchId, documentId }) },
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
    mocks.selectionToken.mockResolvedValue(true)
  })

  it("denies a changed staff workspace before reading a previously granted memo", async () => {
    mocks.selectionToken.mockResolvedValue(false)

    expect((await requestPreview()).status).toBe(404)
    expect(mocks.selectionToken).toHaveBeenCalledWith(workspaceId, ownerId, "staff-1", generationA)
    expect(mocks.resolvePortalPursuitResource).not.toHaveBeenCalled()
  })

  it("denies a memo link missing its page-issued generation", async () => {
    expect((await requestPreview("")).status).toBe(400)
    expect(mocks.selectionToken).not.toHaveBeenCalled()
    expect(mocks.resolvePortalPursuitResource).not.toHaveBeenCalled()
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
      matchId,
      viewer: { kind: "staff-preview", repreneurId: ownerId },
      resource: { kind: "information-memorandum", documentId },
    })
  })

  it("proxies an authorized preview memo without exposing its signed storage URL", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId,
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: documentId,
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

  it("does not revive an old IM link after A to B to A, but accepts the fresh generation", async () => {
    let currentGeneration = generationA
    mocks.selectionToken.mockImplementation(async (_workspace, _owner, _staff, requestedGeneration) => requestedGeneration === currentGeneration)
    mocks.resolvePortalPursuitResource.mockResolvedValue({ kind: "information-memorandum", documentId })
    mocks.createAdminClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { id: documentId, document_type: "deal_book", external_url: null,
          storage_bucket: "opportunity-documents", storage_path: "owner/memo.pdf", recipient_match_id: null }, error: null,
      }) }) }) }),
      storage: { from: () => ({ createSignedUrl: async () => ({
        data: { signedUrl: "https://supabase.test.invalid/storage/v1/object/sign/memo?token=test" }, error: null,
      }) }) },
    })

    expect((await requestPreview(generationA)).status).toBe(200)
    currentGeneration = generationB // selected B
    expect((await requestPreview(generationA)).status).toBe(404)
    currentGeneration = generationC // selected A again
    expect((await requestPreview(generationA)).status).toBe(404)
    expect((await requestPreview(generationC)).status).toBe(200)
    expect(mocks.resolvePortalPursuitResource).toHaveBeenCalledTimes(2)
  })

  it.each([
    ["with a storage path", "opportunity-1/documents/memo.pdf"],
    ["without a storage path", null],
  ])("fails closed for an external preview memo %s", async (_label, storagePath) => {
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId,
    })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: documentId,
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
      documentId,
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
