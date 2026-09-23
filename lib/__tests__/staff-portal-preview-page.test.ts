import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listOptions: vi.fn(),
  listOpportunities: vi.fn(),
  getProfile: vi.fn(),
  listExternal: vi.fn(),
  getAttachments: vi.fn(),
  readJourney: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/actions/repreneur-portal-preview", () => ({
  listStaffPortalPreviewOptions: mocks.listOptions,
  listStaffPortalPreviewOpportunities: mocks.listOpportunities,
  getStaffPortalPreviewProfile: mocks.getProfile,
  listStaffPortalPreviewExternalPursuits: mocks.listExternal,
}))
vi.mock("@/lib/actions/external-pursuit-attachments", () => ({
  getExternalPursuitAttachmentMap: mocks.getAttachments,
}))
vi.mock("@/lib/data/current-pursuit", () => ({ readPortalCurrentPursuit: mocks.readJourney }))

import StaffPortalPreviewPage from "@/app/(dashboard)/portal-preview/page"

const ownerId = "00000000-0000-4000-8000-000000000001"

describe("staff Tools portal page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1", name: "Staff Person", email: "staff@example.test" } })
    mocks.listOptions.mockResolvedValue([{ id: ownerId, name: "Ada Owner", email: "ada@example.test", portalRoleLinked: false, isDemo: false }])
    mocks.listOpportunities.mockResolvedValue({ repreneur: { id: ownerId, first_name: "Ada", last_name: "Owner", is_demo: false }, opportunities: [
      { match_id: null, match_status: null, opportunity_id: "opportunity-1", reference: "Confidential opportunity", public_title: "Safe live one", visible_documents: [], updated_at: "2026-09-23", is_staff_recommended: false, is_outside_current_criteria: false },
      { match_id: null, match_status: null, opportunity_id: "opportunity-2", reference: "Confidential opportunity", public_title: "Safe live two", visible_documents: [], updated_at: "2026-09-23", is_staff_recommended: false, is_outside_current_criteria: false },
    ] })
    mocks.getProfile.mockResolvedValue({ repreneur: null })
    mocks.listExternal.mockResolvedValue([])
    mocks.getAttachments.mockResolvedValue({})
    mocks.readJourney.mockResolvedValue(null)
  })

  it("shows the exact selected person's deal count and authenticated staff identity", async () => {
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Selected repreneur: Ada Owner")
    expect(html).toContain("Signed in as staff: Staff Person")
    expect(html).toContain("2 visible deal(s)")
    expect(html).toContain("Safe live one")
    expect(html).toContain("Safe live two")
    expect(mocks.listOpportunities).toHaveBeenCalledWith(ownerId)
    expect(mocks.listExternal).not.toHaveBeenCalled()
  })

  it("does not resolve an unknown owner or silently open their requested detail", async () => {
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: "unknown", dealId: "00000000-0000-4000-8000-000000000002" }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Repreneur not found")
    expect(mocks.listOpportunities).not.toHaveBeenCalled()
    expect(mocks.readJourney).not.toHaveBeenCalled()
  })
})
