import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
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
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
  })

  it("fails closed when the preview pursuit lacks an exact canonical IM grant", async () => {
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)

    expect((await requestPreview()).status).toBe(404)
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
})
