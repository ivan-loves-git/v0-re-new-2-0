import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  broadDiscoveryPublicationState,
  missingBroadDiscoveryReaderFields,
} from "@/lib/opportunity-broad-discovery-publication"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { setOpportunityBroadDiscoveryVisibility } from "@/lib/actions/opportunities"

const readyOpportunity = {
  status: "active" as const,
  is_demo: false,
  repreneur_exposure: "staff_only" as const,
  public_title: "Industrial services company",
  teaser_summary: "An anonymized industrial services opportunity.",
  sector: "Industrial services",
  location: "Occitanie",
}

describe("controlled Deal Flow publication", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
  })

  it("requires a staff-reviewed active, non-DEMO anonymized teaser", () => {
    expect(broadDiscoveryPublicationState(readyOpportunity)).toEqual({ mode: "publish" })
    expect(
      broadDiscoveryPublicationState({ ...readyOpportunity, repreneur_exposure: "anonymized" }),
    ).toEqual({ mode: "remove" })
    expect(
      broadDiscoveryPublicationState({ ...readyOpportunity, is_demo: true }),
    ).toEqual({ mode: "unavailable" })
    expect(
      broadDiscoveryPublicationState({ ...readyOpportunity, status: "draft" }),
    ).toEqual({ mode: "unavailable" })
    expect(
      broadDiscoveryPublicationState({ ...readyOpportunity, repreneur_exposure: "repreneur_visible" }),
    ).toEqual({ mode: "unavailable" })
  })

  it("names the reader-facing fields a staff member must complete", () => {
    expect(
      missingBroadDiscoveryReaderFields({
        ...readyOpportunity,
        public_title: " ",
        teaser_summary: null,
        sector: null,
        location: "",
      }),
    ).toEqual(["title", "teaser", "sector", "location"])
  })

  it("calls the guarded RPC only for the matching current state", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: readyOpportunity, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const rpc = vi.fn().mockResolvedValue({ data: { id: "opportunity-1" }, error: null })
    mocks.createAdminClient.mockReturnValue({ from, rpc })

    await expect(
      setOpportunityBroadDiscoveryVisibility("opportunity-1", true),
    ).resolves.toMatchObject({ success: true })

    expect(mocks.requireStaffAccess).toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith("set_opportunity_broad_discovery_visibility", {
      p_opportunity_id: "opportunity-1",
      p_visible: true,
      p_actor: "qa-staff",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/portal/deals")
  })

  it("does not mutate a legacy visibility state or incomplete opportunity", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...readyOpportunity, repreneur_exposure: "repreneur_visible" },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ from, rpc })

    await expect(
      setOpportunityBroadDiscoveryVisibility("opportunity-1", false),
    ).resolves.toMatchObject({ success: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("maps a guarded database rejection to a staff-readable response", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: readyOpportunity, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "opportunity_broad_discovery_missing_reader_fields",
      },
    })
    mocks.createAdminClient.mockReturnValue({ from, rpc })

    await expect(
      setOpportunityBroadDiscoveryVisibility("opportunity-1", true),
    ).resolves.toEqual({
      success: false,
      message: "Add the title, teaser, sector and location before making this opportunity visible in Deal Flow.",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("keeps the detail control explicit about anonymized exposure and retained history", async () => {
    const control = await import("node:fs/promises").then(({ readFile }) =>
      readFile("components/opportunities/opportunity-broad-discovery-control.tsx", "utf8"),
    )

    expect(control).toContain("Make visible in Deal Flow")
    expect(control).toContain("Only the anonymized teaser is exposed")
    expect(control).toContain("Existing staff recommendations and pursuits are retained unchanged")
  })
})
