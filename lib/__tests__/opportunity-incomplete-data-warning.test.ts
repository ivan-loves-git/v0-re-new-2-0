import { beforeEach, describe, expect, it, vi } from "vitest"

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

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

import { createOpportunityFromDraft } from "@/lib/actions/opportunities"
import { createOpportunityIntake } from "@/lib/actions/opportunity-intake"
import {
  readOpportunityHeadcount,
  readOpportunityNumber,
} from "@/lib/utils/opportunity-incomplete-data"

describe("opportunity intake draft rules", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
  })

  it("requires a safe public title for a new staff-only draft", async () => {
    const formData = new FormData()
    formData.set("reference", "OPP-DRAFT-001")
    formData.set("status", "draft")
    await expect(createOpportunityIntake(formData)).resolves.toMatchObject({
      success: false,
      fieldErrors: { public_title: expect.any(String) },
    })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("returns committed identity for a valid staff-only draft", async () => {
    const formData = new FormData()
    formData.set("reference", "OPP-DRAFT-001")
    formData.set("public_title", "Anonymized industrial services business")
    formData.set("status", "draft")
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "created-opportunity" },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createOpportunityIntake(formData)).resolves.toEqual({
      success: true,
      message: "Opportunity OPP-DRAFT-001 created.",
      opportunityId: "created-opportunity",
      opportunityReference: "OPP-DRAFT-001",
    })

    expect(rpc).toHaveBeenCalledWith("create_opportunity_with_office_context", {
      p_reference: "OPP-DRAFT-001",
      p_source_office_id: null,
      p_affiliation_ids: [],
      p_primary_affiliation_id: null,
      p_description: null,
      p_target_status: "draft",
      p_actor: "qa-staff",
      p_opportunity_fields: expect.objectContaining({
        revenue_meur: null,
        ebitda_keur: null,
        headcount: null,
      }),
    })
  })

  it("preserves confirmed numeric zero while leaving unknown numerical fields null", () => {
    const formData = new FormData()
    expect(readOpportunityNumber(formData, "revenue_meur")).toBeNull()
    expect(readOpportunityHeadcount(formData)).toBeNull()

    formData.set("revenue_meur", "0")
    formData.set("headcount_range", "0")
    expect(readOpportunityNumber(formData, "revenue_meur")).toBe(0)
    expect(readOpportunityHeadcount(formData)).toBe(0)
  })

  it("does not retain a direct create shortcut outside canonical intake", async () => {
    await expect(
      createOpportunityFromDraft({
        reference: "OPP-LEGACY-SHORTCUT",
        status: "draft",
        repreneur_exposure: "staff_only",
      }),
    ).rejects.toThrow("Direct opportunity creation is retired")

    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
