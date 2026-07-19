import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getCurrentUserAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { GET } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"

const REPRENEUR_ACCESS = {
  role: "repreneur",
  repreneurId: "repreneur-1",
  repreneurName: "QA Repreneur",
  user: { id: "qa-repreneur" },
}

function setupAdminClient({
  match,
  document,
}: {
  match: Record<string, unknown> | null
  document: Record<string, unknown> | null
}) {
  const matchMaybeSingle = vi.fn().mockResolvedValue({ data: match, error: null })
  const matchEqRepreneur = vi.fn(() => ({ maybeSingle: matchMaybeSingle }))
  const matchEqId = vi.fn(() => ({ eq: matchEqRepreneur }))
  const matchSelect = vi.fn(() => ({ eq: matchEqId }))

  const documentMaybeSingle = vi.fn().mockResolvedValue({ data: document, error: null })
  const documentEqVisibility = vi.fn(() => ({ maybeSingle: documentMaybeSingle }))
  const documentEqOpportunity = vi.fn(() => ({ eq: documentEqVisibility }))
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

const approvedMemo = {
  id: "memo-1",
  document_type: "deal_book",
  visibility: "approved_for_repreneur",
  external_url: null,
  storage_bucket: "opportunity-documents",
  storage_path: "opportunities/opportunity-1/info-memo.pdf",
}

describe("repreneur info-memo download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue(REPRENEUR_ACCESS)
  })

  it("denies a received but unsigned NDA before reading memo metadata", async () => {
    const { createSignedUrl, documentSelect } = setupAdminClient({
      match: {
        ...activeMatch,
        nda_status: "sent",
        nda_received_at: "2026-07-19T08:00:00.000Z",
      },
      document: approvedMemo,
    })

    expect((await requestMemo()).status).toBe(403)
    expect(documentSelect).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("denies a signed NDA when the approved memo has no file", async () => {
    const { createSignedUrl } = setupAdminClient({
      match: { ...activeMatch, nda_status: "signed" },
      document: { ...approvedMemo, storage_path: null },
    })

    expect((await requestMemo()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it("permits a signed NDA with an approved memo file", async () => {
    const { createSignedUrl } = setupAdminClient({
      match: { ...activeMatch, nda_status: "signed" },
      document: approvedMemo,
    })

    const response = await requestMemo()

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-info-memo")
    expect(createSignedUrl).toHaveBeenCalledWith(
      "opportunities/opportunity-1/info-memo.pdf",
      60,
    )
  })
})
