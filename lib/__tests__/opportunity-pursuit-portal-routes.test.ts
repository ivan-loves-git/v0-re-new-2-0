import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPortalPursuitProjection: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/data/opportunity-pursuit-projection", () => ({
  getPortalPursuitProjection: mocks.getPortalPursuitProjection,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET as getInformationMemo } from "@/app/portal/deals/[matchId]/documents/[documentId]/route"
import { GET as getTemplate } from "@/app/portal/deals/[matchId]/nda-template/route"

describe("canonical portal pursuit routes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fails closed for an IM without an exact canonical grant", async () => {
    mocks.getPortalPursuitProjection.mockResolvedValue({
      enabled: true,
      gate2Passed: true,
      revoked: false,
      confidentialGrant: null,
    })

    const response = await getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-1"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-1" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("denies a different IM even where another exact grant exists", async () => {
    mocks.getPortalPursuitProjection.mockResolvedValue({
      enabled: true,
      gate2Passed: true,
      revoked: false,
      confidentialGrant: { information_memo_document_id: "memo-granted" },
    })

    const response = await getInformationMemo(
      new NextRequest("http://localhost/portal/deals/match-1/documents/memo-other"),
      { params: Promise.resolve({ matchId: "match-1", documentId: "memo-other" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("denies the template before Gate 1 without loading artifact metadata", async () => {
    mocks.getPortalPursuitProjection.mockResolvedValue({ enabled: true, gate1Passed: false, revoked: false })

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("denies the template immediately when access has been revoked", async () => {
    mocks.getPortalPursuitProjection.mockResolvedValue({ enabled: true, gate1Passed: true, revoked: true })

    const response = await getTemplate(
      new Request("http://localhost/portal/deals/match-1/nda-template"),
      { params: Promise.resolve({ matchId: "match-1" }) },
    )

    expect(response.status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
