import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  verifyStaffPortalSelection: vi.fn(),
  createAdminClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  recalculateRepreneurScoresAndMatches: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: boundary.requireStaffAccess }))
vi.mock("@/lib/staff-portal-selection", () => ({ verifyStaffPortalSelection: boundary.verifyStaffPortalSelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: boundary.createAdminClient }))
vi.mock("@/lib/repreneur-profile-refresh", () => ({ recalculateRepreneurScoresAndMatches: boundary.recalculateRepreneurScoresAndMatches }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { updateRepreneurTargetThesis, type TargetThesisInput } from "@/lib/actions/repreneur-profile"

const input: TargetThesisInput = {
  q12_geo_zones: ["all-france"],
  q13_target_sectors_v2: ["Tech & Digital"],
  q14_deal_size: ["3-5M"],
  q16_equity: ">450",
  target_revenue_min_meur: 12,
  target_revenue_max_meur: null,
  target_ebitda_min_keur: null,
  target_ebitda_max_keur: null,
  target_ebitda_margin_min_pct: null,
  target_staff_size_min: null,
  target_staff_size_max: null,
}

describe("selected staff target-thesis assistance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boundary.requireStaffAccess.mockResolvedValue({ user: { id: "staff-a", email: "staff@re-new.invalid" } })
    boundary.verifyStaffPortalSelection.mockResolvedValue(null)
    boundary.createAdminClient.mockReturnValue({ from: boundary.from, rpc: boundary.rpc })
  })

  it("returns a controlled stale-workspace outcome before any data write", async () => {
    await expect(updateRepreneurTargetThesis("repreneur-a", input, "earlier-version", "retry-a", "stale-selection"))
      .resolves.toEqual({ code: "staff_workspace_changed" })
    expect(boundary.verifyStaffPortalSelection).toHaveBeenCalledWith("stale-selection", "repreneur-a", "staff-a")
    expect(boundary.createAdminClient).not.toHaveBeenCalled()
  })

  it("does not expose an outcome or read data before staff authorization", async () => {
    boundary.requireStaffAccess.mockRejectedValue(new Error("denied"))
    await expect(updateRepreneurTargetThesis("repreneur-a", input, "earlier-version", "retry-a", "selection"))
      .rejects.toThrow("denied")
    expect(boundary.verifyStaffPortalSelection).not.toHaveBeenCalled()
    expect(boundary.createAdminClient).not.toHaveBeenCalled()
  })

  it("does not surface database prose or claim a save on an atomic version conflict", async () => {
    boundary.verifyStaffPortalSelection.mockResolvedValue({ workspaceId: "workspace-a", generation: "generation-a" })
    boundary.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          q12_geo_zones: ["all-france"], q13_target_sectors_v2: ["Tech & Digital"],
          q14_deal_size: ["3-5M"], target_location: [], sector_preferences: [], target_acquisition_size: null,
        },
        error: null,
      }) }) }),
    })
    boundary.rpc.mockResolvedValue({ error: { message: "PRIVATE DATABASE FAILURE" } })

    await expect(updateRepreneurTargetThesis("repreneur-a", input, "earlier-version", "retry-a", "selection"))
      .resolves.toEqual({ code: "staff_profile_changed" })
    expect(boundary.rpc).toHaveBeenCalledWith("w196_update_staff_target_thesis", expect.objectContaining({
      p_repreneur_id: "repreneur-a", p_expected_updated_at: "earlier-version",
      p_operation_key: "retry-a", p_workspace_generation: "generation-a",
    }))
    expect(boundary.recalculateRepreneurScoresAndMatches).not.toHaveBeenCalled()
  })
})
