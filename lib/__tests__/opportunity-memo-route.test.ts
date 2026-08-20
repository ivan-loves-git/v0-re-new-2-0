import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  fetch: vi.fn(),
  resolvePortalPursuitResource: vi.fn(),
}))

vi.mock("@/lib/data/current-pursuit", () => ({
  resolvePortalPursuitResource: mocks.resolvePortalPursuitResource,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { GET } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"

function setupAdminClient({
  document,
  matchError = null,
  documentError = null,
}: {
  document: Record<string, unknown> | null
  matchError?: { message: string } | null
  documentError?: { message: string } | null
}) {
  const matchMaybeSingle = vi.fn().mockResolvedValue({
    data: matchError ? null : activeMatch,
    error: matchError,
  })
  const matchEqId = vi.fn(() => ({ maybeSingle: matchMaybeSingle }))
  const matchSelect = vi.fn(() => ({ eq: matchEqId }))

  const documentMaybeSingle = vi.fn().mockResolvedValue({
    data: documentError ? null : document,
    error: documentError,
  })
  const documentEqOpportunity = vi.fn(() => ({ maybeSingle: documentMaybeSingle }))
  const documentEqId = vi.fn(() => ({ eq: documentEqOpportunity }))
  const documentSelect = vi.fn(() => ({ eq: documentEqId }))

  const databaseFrom = vi.fn((table: string) => {
    if (table === "opportunity_matches") return { select: matchSelect }
    if (table === "opportunity_documents") return { select: documentSelect }
    throw new Error(`Unexpected table: ${table}`)
  })
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: {
      signedUrl:
        "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/info-memo?token=test",
    },
    error: null,
  })

  mocks.createAdminClient.mockReturnValue({
    from: databaseFrom,
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  })

  return { createSignedUrl, documentSelect }
}

function requestMemo() {
  return GET(
    new NextRequest("http://localhost/portal/deals/match-1/documents/memo-1"),
    { params: Promise.resolve({ matchId: "match-1", documentId: "memo-1" }) },
  )
}

const activeMatch = {
  id: "match-1",
  opportunity_id: "opportunity-1",
  repreneur_id: "repreneur-1",
  status: "active_pursuit",
}

const informationMemo = {
  id: "memo-1",
  document_type: "deal_book",
  external_url: null,
  storage_bucket: "opportunity-documents",
  storage_path: "opportunities/opportunity-1/info-memo.pdf",
}

describe("repreneur info-memo download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetch)
    mocks.fetch.mockResolvedValue(
      new Response("confidential memo", {
        headers: {
          "content-type": "application/pdf",
          "content-length": "999999",
          "content-disposition": 'inline; filename="untrusted.html"',
        },
      }),
    )
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "information-memorandum",
      documentId: "memo-1",
    })
  })

  it("denies a legacy signed label without consulting memo metadata", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    expect((await requestMemo()).status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("denies a revoked or expired grant before reading memo metadata", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    expect((await requestMemo()).status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("denies a different memo even when the pursuit has a live grant", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)
    const response = await GET(
      new NextRequest("http://localhost/portal/deals/match-1/documents/other-memo"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "other-memo" }) },
    )

    expect(response.status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it.each([
    ["with a storage path", informationMemo.storage_path],
    ["without a storage path", null],
  ])("fails closed for a legacy external document %s", async (_label, storagePath) => {
    const { createSignedUrl } = setupAdminClient({
      document: {
        ...informationMemo,
        external_url: "https://storage.example.test/legacy-signed-memo",
        storage_path: storagePath,
      },
    })

    const response = await requestMemo()

    expect(response.status).toBe(404)
    expect(response.headers.get("location")).toBeNull()
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it("proxies only the exact current granted IM after canonical portal projection succeeds", async () => {
    const { createSignedUrl } = setupAdminClient({
      document: informationMemo,
    })

    const response = await requestMemo()

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="information-memorandum.pdf"',
    )
    expect(response.headers.get("content-length")).toBeNull()
    await expect(response.text()).resolves.toBe("confidential memo")
    expect(createSignedUrl).toHaveBeenCalledWith(
      "opportunities/opportunity-1/info-memo.pdf",
      60,
    )
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/info-memo?token=test",
      { cache: "no-store", redirect: "error" },
    )
    expect(mocks.resolvePortalPursuitResource).toHaveBeenCalledWith({
      matchId: "match-1",
      viewer: { kind: "portal" },
      resource: { kind: "information-memorandum", documentId: "memo-1" },
    })
  })

  it("does not leak a signed URL when upstream storage rejects it", async () => {
    setupAdminClient({ document: informationMemo })
    mocks.fetch.mockResolvedValueOnce(new Response("expired", { status: 403 }))

    const response = await requestMemo()

    expect(response.status).toBe(502)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    await expect(response.json()).resolves.toEqual({
      error: "Document file is unavailable.",
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.test.invalid/storage/v1/object/sign/opportunity-documents/info-memo?token=test",
      { cache: "no-store", redirect: "error" },
    )
  })

  it.each([
    ["match", { matchError: { message: "relation opportunity_matches_internal does not exist" } }],
    ["document", { documentError: { message: "permission denied for secret_storage_table" } }],
  ])("does not expose raw %s metadata errors", async (_scope, errors) => {
    setupAdminClient({ document: informationMemo, ...errors })

    const response = await requestMemo()

    expect(response.status).toBe(500)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    const body = await response.text()
    expect(body).toContain("Confidential document is unavailable.")
    expect(body).not.toContain("opportunity_matches_internal")
    expect(body).not.toContain("secret_storage_table")
  })

  it("rejects an active HTML response from signed storage", async () => {
    setupAdminClient({ document: informationMemo })
    mocks.fetch.mockResolvedValueOnce(
      new Response("<html>unexpected</html>", {
        headers: { "content-type": "text/html" },
      }),
    )

    const response = await requestMemo()

    expect(response.status).toBe(502)
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toEqual({
      error: "Document file is unavailable.",
    })
  })
})
