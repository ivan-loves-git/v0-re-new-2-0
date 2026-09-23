import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  resolvePortalPursuitResource: vi.fn(),
  createAdminClient: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ getCurrentUserAccess: mocks.getCurrentUserAccess }))
vi.mock("@/lib/data/current-pursuit", () => ({ resolvePortalPursuitResource: mocks.resolvePortalPursuitResource }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from "@/app/(dashboard)/portal-preview/deals/[matchId]/nda-template/route"

const ownerId = "00000000-0000-4000-8000-000000000001"
const matchId = "00000000-0000-4000-8000-000000000002"

function request(repreneurId = ownerId) {
  return GET(
    new NextRequest(`http://localhost/portal-preview/deals/${matchId}/nda-template?repreneurId=${repreneurId}`),
    { params: Promise.resolve({ matchId }) },
  )
}

describe("staff-selected NDA template route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetch)
    mocks.fetch.mockResolvedValue(new Response("exact template", { headers: { "content-type": "application/pdf" } }))
  })

  it("denies a repreneur session before resolving the selected-owner resource", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "repreneur" })

    expect((await request()).status).toBe(403)
    expect(mocks.resolvePortalPursuitResource).not.toHaveBeenCalled()
  })

  it("fails closed for a missing owner or revoked Gate 1 template", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
    expect((await request("")).status).toBe(400)
    mocks.resolvePortalPursuitResource.mockResolvedValue(null)
    expect((await request()).status).toBe(404)
    expect(mocks.resolvePortalPursuitResource).toHaveBeenCalledWith({
      matchId,
      viewer: { kind: "staff-preview", repreneurId: ownerId },
      resource: { kind: "nda-template" },
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("proxies only an exact Gate 1 template without exposing a signed URL", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1" } })
    mocks.resolvePortalPursuitResource.mockResolvedValue({
      kind: "nda-template", documentId: "template-1",
      storageBucket: "opportunity-documents", storagePath: "template/nda.pdf",
    })
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://supabase.test.invalid/storage/v1/object/sign/template?token=test" },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ storage: { from: vi.fn(() => ({ createSignedUrl })) } })

    const response = await request()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="nda-template.pdf"')
    await expect(response.text()).resolves.toBe("exact template")
    expect(createSignedUrl).toHaveBeenCalledWith("template/nda.pdf", 60, { download: true })
  })
})
