import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(), requireStaffAccess: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: m.requirePortalAccess, requireStaffAccess: m.requireStaffAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }))
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }))

import { approveDiscoveryDigestCopy, optOutOfMyDiscoveryDigest } from "@/lib/actions/discovery-digest"

describe("digest owner and staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requirePortalAccess.mockResolvedValue({ user: { id: "fictional-owner" }, repreneurId: "fictional-profile" })
    m.requireStaffAccess.mockResolvedValue({ user: { id: "fictional-staff" } })
    m.rpc.mockResolvedValue({ data: true, error: null })
  })

  it("derives the one-way opt-out owner from the authenticated portal session", async () => {
    await optOutOfMyDiscoveryDigest()
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("d136_opt_out", { p_user_id: "fictional-owner" })
    expect(m.revalidate).toHaveBeenCalledWith("/portal/profile")
  })

  it("denies an unlinked session before a service call", async () => {
    m.requirePortalAccess.mockResolvedValue({ user: { id: "fictional-owner" }, repreneurId: null })
    await expect(optOutOfMyDiscoveryDigest()).rejects.toThrow(/linked owner/)
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it("binds staff approval to the exact title and teaser displayed to the reviewer", async () => {
    await approveDiscoveryDigestCopy("fictional-opportunity", "Exact public title", "Exact approved teaser")
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith("d136_approve_copy", {
      p_opportunity_id: "fictional-opportunity",
      p_actor: "fictional-staff",
      p_expected_public_title: "Exact public title",
      p_expected_teaser: "Exact approved teaser",
    })
  })
})
