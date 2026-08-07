import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPortalPursuitProjection: vi.fn(),
}))

vi.mock("@/lib/data/opportunity-pursuit-projection", () => ({
  getPortalPursuitProjection: mocks.getPortalPursuitProjection,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { GET } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"

function setupAdminClient({
  document,
}: {
  document: Record<string, unknown> | null
}) {
  const matchMaybeSingle = vi.fn().mockResolvedValue({ data: activeMatch, error: null })
  const matchEqId = vi.fn(() => ({ maybeSingle: matchMaybeSingle }))
  const matchSelect = vi.fn(() => ({ eq: matchEqId }))

  const documentMaybeSingle = vi.fn().mockResolvedValue({ data: document, error: null })
  const documentEqOpportunity = vi.fn(() => ({ maybeSingle: documentMaybeSingle }))
  const documentEqId = vi.fn(() => ({ eq: documentEqOpportunity }))
  const documentSelect = vi.fn(() => ({ eq: documentEqId }))

  const databaseFrom = vi.fn((table: string) => {
    if (table === "opportunity_matches") return { select: matchSelect }
    if (table === "opportunity_documents") return { select: documentSelect }
    throw new Error(`Unexpected table: ${table}`)
  })
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://storage.example.test/signed-info-memo" },
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

const exactLiveGrant = {
  enabled: true,
  gate1Passed: true,
  gate2Passed: true,
  dispatched: true,
  revoked: false,
  confidentialGrant: {
    informationMemoDocumentId: "memo-1",
    grantedAt: "2026-08-07T10:00:00.000Z",
    source: { firmName: "Source firm", officeName: "Milan", contactNames: ["Contact"] },
  },
}

describe("repreneur info-memo download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPortalPursuitProjection.mockResolvedValue(exactLiveGrant)
  })

  it("denies a legacy signed label without consulting memo metadata", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    mocks.getPortalPursuitProjection.mockResolvedValue({
      ...exactLiveGrant,
      gate2Passed: false,
      confidentialGrant: null,
    })

    expect((await requestMemo()).status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("denies a revoked or expired grant before reading memo metadata", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    mocks.getPortalPursuitProjection.mockResolvedValue({
      ...exactLiveGrant,
      revoked: true,
    })

    expect((await requestMemo()).status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("denies a different memo even when the pursuit has a live grant", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      document: informationMemo,
    })
    const response = await GET(
      new NextRequest("http://localhost/portal/deals/match-1/documents/other-memo"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "other-memo" }) },
    )

    expect(response.status).toBe(404)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("permits only the exact current granted IM after canonical portal projection succeeds", async () => {
    const { createSignedUrl } = setupAdminClient({
      document: informationMemo,
    })

    const response = await requestMemo()

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-info-memo")
    expect(createSignedUrl).toHaveBeenCalledWith(
      "opportunities/opportunity-1/info-memo.pdf",
      60,
    )
    expect(mocks.getPortalPursuitProjection).toHaveBeenCalledWith("match-1")
  })
})
