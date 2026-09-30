import { isValidElement, type ComponentProps, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  listOptions: vi.fn(),
  listOpportunities: vi.fn(),
  listOwned: vi.fn(),
  getOpportunity: vi.fn(),
  getProfile: vi.fn(),
  listExternal: vi.fn(),
  getAttachments: vi.fn(),
  readJourney: vi.fn(),
  readActions: vi.fn(),
  selectionToken: vi.fn(),
  parseSelection: vi.fn(),
  createAdminClient: vi.fn(),
  previewLanguage: vi.fn(),
  readNextActions: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }), usePathname: () => "/portal-preview", useSearchParams: () => new URLSearchParams() }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/actions/repreneur-portal-preview", () => ({
  listStaffPortalPreviewOptions: mocks.listOptions,
  listStaffPortalPreviewOpportunities: mocks.listOpportunities,
  listStaffPortalPreviewOwnedOpportunities: mocks.listOwned,
  getStaffPortalPreviewOpportunity: mocks.getOpportunity,
  getStaffPortalPreviewProfile: mocks.getProfile,
  listStaffPortalPreviewExternalPursuits: mocks.listExternal,
}))
vi.mock("@/lib/actions/external-pursuit-attachments", () => ({
  getExternalPursuitAttachmentMap: mocks.getAttachments,
}))
vi.mock("@/lib/data/current-pursuit", () => ({
  readPortalCurrentPursuit: mocks.readJourney,
  readPortalDealActionIndicators: mocks.readActions,
}))
vi.mock("@/lib/data/portal-next-actions", () => ({ readPortalNextActions: mocks.readNextActions }))
vi.mock("@/lib/staff-portal-selection", () => ({ currentStaffPortalSelectionToken: mocks.selectionToken, parseStaffPortalSelection: mocks.parseSelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/i18n/server-language", () => ({ previewUiLanguage: mocks.previewLanguage }))

import { PortalPursuitsContent } from "@/components/portal/portal-pursuits-content"
import StaffPortalPreviewPage from "@/app/(dashboard)/portal-preview/page"

const ownerId = "00000000-0000-4000-8000-000000000001"
const matchId = "00000000-0000-4000-8000-000000000002"
const otherMatchId = "00000000-0000-4000-8000-000000000003"
const workspaceId = "00000000-0000-4000-8000-000000000004"

// Inspect the public server-to-client screen payload, not just visible HTML.
function findPursuitsContentProps(node: ReactNode): ComponentProps<typeof PortalPursuitsContent> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findPursuitsContentProps(child)
      if (found) return found
    }
  }
  if (!isValidElement(node)) return null
  if (node.type === PortalPursuitsContent) return node.props as ComponentProps<typeof PortalPursuitsContent>
  return findPursuitsContentProps((node.props as { children?: ReactNode }).children)
}

const allowedSidebarDeal = {
  match_id: matchId, match_status: "proposed", pursuit_stage: null,
  interest_rejected: false, recommendation_expires_at: null,
  public_title: "Allowed public title", canonical_sector: "Industrie manufacturière",
  sector: "Industrie", activity: "Manufacturing", geography_label: "France", location: "France",
}

describe("staff Tools portal page", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-1", name: "Staff Person", email: "staff@example.test" } })
    mocks.listOptions.mockResolvedValue([{ id: ownerId, name: "Ada Owner", email: "ada@example.test", portalRoleLinked: false, isDemo: false }])
    mocks.listOpportunities.mockResolvedValue({ repreneur: { id: ownerId, first_name: "Ada", last_name: "Owner", is_demo: false }, opportunities: [
      { match_id: null, match_status: null, opportunity_id: "opportunity-1", reference: "Confidential opportunity", public_title: "Safe live one", visible_documents: [], updated_at: "2026-09-23", is_staff_recommended: false, is_outside_current_criteria: false },
      { match_id: null, match_status: null, opportunity_id: "opportunity-2", reference: "Confidential opportunity", public_title: "Safe live two", visible_documents: [], updated_at: "2026-09-23", is_staff_recommended: false, is_outside_current_criteria: false },
    ] })
    const defaultSource = await mocks.listOpportunities()
    mocks.listOpportunities.mockClear()
    mocks.listOpportunities.mockResolvedValue({ ...defaultSource, deals: defaultSource.opportunities,
      automaticMatching: { complete: false, missing: ["sector"] }, demoProfile: false })
    mocks.listOwned.mockResolvedValue(defaultSource)
    mocks.getOpportunity.mockImplementation(async (_owner, id) => {
      const source = await mocks.listOwned()
      return source.opportunities.find((deal: { match_id: string; opportunity_id: string }) => deal.match_id === id || deal.opportunity_id === id) ?? null
    })
    mocks.getProfile.mockResolvedValue({ repreneur: null })
    mocks.listExternal.mockResolvedValue([])
    mocks.getAttachments.mockResolvedValue({})
    mocks.readJourney.mockResolvedValue(null)
    mocks.readActions.mockResolvedValue({})
    mocks.selectionToken.mockResolvedValue("staff-selection-token")
    mocks.parseSelection.mockReturnValue({ generation: "00000000-0000-4000-8000-000000000005" })
    mocks.createAdminClient.mockReturnValue({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { updated_at: "2026-09-27T08:00:00Z" } }) }) }),
    }) })
    mocks.previewLanguage.mockResolvedValue("en")
    mocks.readNextActions.mockResolvedValue({ state: "ready", asOf: "2026-09-30T00:00:00Z",
      yourActions: [], waiting: [], resources: [] })
  })


  it("keeps customer Deal Flow metadata and sorting in the selected owner route", async () => {
    const source = await mocks.listOpportunities()
    mocks.listOpportunities.mockClear()
    mocks.listOpportunities.mockResolvedValue({ ...source, automaticMatching: { complete: true, missing: [] } })
    const html = renderToStaticMarkup(await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, sort: "deal_size" }) }))
    expect(mocks.listOpportunities).toHaveBeenCalledWith(ownerId, undefined, "deal_size")
    expect(html).toContain('aria-label="Sort deal flow"')
    expect(html).toContain("Revenue")
    expect(html).not.toContain("Complete your acquisition project")
    expect(html).not.toContain("Mark as reviewed")
  })

  it("reads the selected profile and owned matches without the live Deal Flow", async () => {
    const html = renderToStaticMarkup(await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, view: "profile" }) }))
    expect(html).toContain("Selected repreneur profile unavailable")
    expect(mocks.getProfile).toHaveBeenCalledWith(ownerId)
    expect(mocks.listOwned).toHaveBeenCalledWith(ownerId)
    expect(mocks.listOpportunities).not.toHaveBeenCalled()
    expect(mocks.listExternal).not.toHaveBeenCalled()
  })

  it("renders complete customer Deals guidance in preview", async () => {
    const html = renderToStaticMarkup(await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId }) }))
    expect(html).toContain("Your deals")
    expect(html).toContain("Deal flow")
    expect(html).toContain("Complete your acquisition project")
    expect(html).toContain(`view=profile`)
    expect(html).not.toContain('href="/portal/profile')
  })

  it("loads no Deal Flow for the selected External screen", async () => {
    const html = renderToStaticMarkup(await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, view: "external-pursuits" }) }))
    expect(html).toContain("Your pursuits")
    expect(mocks.listOpportunities).not.toHaveBeenCalled()
    expect(mocks.getProfile).not.toHaveBeenCalled()
    expect(mocks.listExternal).toHaveBeenCalledWith(ownerId)
  })

  it("renders the shared selected-deal workspace with staff-scoped navigation and assistance", async () => {
    mocks.listOwned.mockResolvedValue({ repreneur: { id: ownerId, is_demo: false }, opportunities: [
      { match_id: matchId, match_status: "proposed", opportunity_id: "00000000-0000-4000-8000-000000000011", public_title: "Selected safe deal", teaser_summary: "Approved public description", visible_documents: [], updated_at: "2026-09-27T08:00:00Z", recommendation_expires_at: null, criteria_comparison: [
        { key: "sector", outcome: "within_target", target: ["Industry"], actual: "Industry" },
        { key: "geography", outcome: "within_target", target: ["France"], actual: "France" },
        { key: "revenue", outcome: "within_target", target: { min: 1, max: 5 }, actual: 3 },
        { key: "ebitda", outcome: "within_target", target: { min: 100, max: 500 }, actual: 300 },
        { key: "margin", outcome: "within_target", target: 10, actual: 12 },
        { key: "team", outcome: "within_target", target: { min: 10, max: 50 }, actual: 20 },
      ] },
      { match_id: otherMatchId, match_status: "interested", opportunity_id: "00000000-0000-4000-8000-000000000012", public_title: "Other safe selected-owner deal", visible_documents: [], updated_at: "2026-09-27T08:00:00Z" },
    ] })
    mocks.readActions.mockResolvedValue({ [matchId]: "respond", [otherMatchId]: null })

    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({
      repreneurId: ownerId, workspaceId, dealId: matchId, q: "safe", status: "awaiting",
    }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-wave-workspace="pursuit"')
    expect(html).toContain("Approved public description")
    expect(html).toContain("Your criteria")
    expect(html).toContain("Documents")
    expect(html).toContain("Journey")
    expect(html).toContain("Other safe selected-owner deal")
    expect(html).toContain(`href="/portal-preview?repreneurId=${ownerId}&amp;dealId=${otherMatchId}&amp;workspaceId=${workspaceId}&amp;q=safe&amp;status=awaiting"`)
    expect(html).toContain("Re-New staff response for Ada Owner")
    expect(html).toContain("staff_portal_assistance")
    expect(html).toContain(`repreneurId=${ownerId}`)
    expect(html).toContain(`workspaceId=${workspaceId}`)
    expect(html).not.toContain('href="/portal/deals/')
    expect(html).not.toContain('data-wave-action="express_interest"')
    expect(html).not.toContain('data-wave-workflow="portal_deals"')
    expect(html).not.toContain("Mark as reviewed")
    expect(mocks.readActions).toHaveBeenCalledWith([matchId, otherMatchId], { kind: "staff-preview", repreneurId: ownerId })
  })

  it("opens the selected owner's matched list workspace from Re-New Pursuits without selecting a deal", async () => {
    mocks.listOwned.mockResolvedValue({ repreneur: { id: ownerId, is_demo: false }, opportunities: [
      { match_id: matchId, match_status: "proposed", opportunity_id: "00000000-0000-4000-8000-000000000011", public_title: "Selected-owner pursuit", visible_documents: [], updated_at: "2026-09-27T08:00:00Z" },
      { match_id: null, match_status: null, opportunity_id: "00000000-0000-4000-8000-000000000012", public_title: "Discovery only", visible_documents: [], updated_at: "2026-09-27T08:00:00Z" },
    ] })

    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, view: "renew-pursuits" }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('data-wave-workspace="pursuit"')
    expect(html).toContain("Selected-owner pursuit")
    expect(html).not.toContain("Discovery only")
    expect(html).toContain(`href="/portal-preview?repreneurId=${ownerId}&amp;dealId=${matchId}&amp;workspaceId=${workspaceId}&amp;returnView=renew-pursuits"`)
    expect(mocks.readActions).toHaveBeenCalledWith([matchId], { kind: "staff-preview", repreneurId: ownerId })
    expect(mocks.readNextActions).toHaveBeenCalledWith({ kind: "staff-preview", repreneurId: ownerId,
      selectionToken: "staff-selection-token" }, expect.any(Object), expect.objectContaining({ indicators: {} }))
  })

  it("denies a stale staff workspace without rendering a selected deal or actions", async () => {
    mocks.listOwned.mockResolvedValue({ repreneur: { id: ownerId }, opportunities: [
      { match_id: matchId, match_status: "active_pursuit", opportunity_id: "00000000-0000-4000-8000-000000000011", public_title: "No longer selected", visible_documents: [] },
    ] })
    mocks.selectionToken.mockResolvedValue(null)

    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, dealId: matchId }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Staff workspace changed")
    expect(html).not.toContain("No longer selected")
    expect(html).not.toContain('data-wave-workspace="pursuit"')
    expect(mocks.readJourney).not.toHaveBeenCalled()
    expect(mocks.readActions).not.toHaveBeenCalled()
    expect(mocks.listOwned).not.toHaveBeenCalled()
    expect(mocks.getOpportunity).not.toHaveBeenCalled()
  })

  it("denies a selected deal outside the chosen owner's safe list", async () => {
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, dealId: matchId }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Deal not visible in portal preview")
    expect(html).not.toContain('data-wave-workspace="pursuit"')
    expect(mocks.readJourney).not.toHaveBeenCalled()
    expect(mocks.readActions).not.toHaveBeenCalled()
  })

  it("shows the exact selected person's deal count and authenticated staff identity", async () => {
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Selected repreneur: Ada Owner")
    expect(html).toContain("Signed in as staff: Staff Person")
    expect(html).toContain("2 visible deal(s)")
    expect(html).toContain("Safe live one")
    expect(html).toContain("Safe live two")
    expect(mocks.listOpportunities).toHaveBeenCalledWith(ownerId, undefined, "relevance")
    expect(mocks.listExternal).not.toHaveBeenCalled()
  })

  it("does not resolve an unknown owner or silently open their requested detail", async () => {
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: "unknown", dealId: "00000000-0000-4000-8000-000000000002" }) })
    const html = renderToStaticMarkup(page)

    expect(html).toContain("Repreneur not found")
    expect(mocks.listOpportunities).not.toHaveBeenCalled()
    expect(mocks.readJourney).not.toHaveBeenCalled()
  })

  it("shows a French customer subtree while staff identity and preview chrome remain English", async () => {
    mocks.previewLanguage.mockResolvedValue("fr")
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId }) })
    const html = renderToStaticMarkup(page)
    expect(html).toContain("Portal preview")
    expect(html).toContain("Signed in as staff: Staff Person")
    expect(html).toContain('lang="fr"')
    expect(html).toContain('aria-label="Français" aria-pressed="true"')
    expect(html).toContain("Opportunités disponibles")
    expect(html).toContain('>Opportunités</button>')
    expect(html).toContain('>Profil</button>')
    expect(html).toContain("Safe live one")
  })

  it("keeps the selected-owner External board available when optional owned-match summary fails", async () => {
    mocks.listOwned.mockRejectedValue(new Error("Owned match summary unavailable"))
    const html = renderToStaticMarkup(await StaffPortalPreviewPage({ searchParams: Promise.resolve({
      repreneurId: ownerId, workspaceId, view: "external-pursuits",
    }) }))
    expect(html).toContain('aria-label="Pursuit board"')
    expect(html).toContain("New external pursuit")
    expect(html).toContain("Acting as Re-New staff for Ada Owner")
    expect(html).toContain("Current actions are unavailable")
    expect(mocks.readNextActions).not.toHaveBeenCalled()
  })

  it("does not conceal a required External board read failure", async () => {
    mocks.listExternal.mockRejectedValue(new Error("External board denied"))
    await expect(StaffPortalPreviewPage({ searchParams: Promise.resolve({
      repreneurId: ownerId, workspaceId, view: "external-pursuits",
    }) })).rejects.toThrow("External board denied")
  })

  it.each([
    { view: "profile", dealId: undefined },
    { view: "renew-pursuits", dealId: undefined },
    { view: "external-pursuits", dealId: matchId },
  ])("retains the required owned-match failure boundary for $view with deal $dealId", async ({ view, dealId }) => {
    mocks.listOwned.mockRejectedValue(new Error("Required owned matches unavailable"))
    await expect(StaffPortalPreviewPage({ searchParams: Promise.resolve({
      repreneurId: ownerId, workspaceId, view, dealId,
    }) })).rejects.toThrow("Required owned matches unavailable")
  })

  it.each([
    { view: "renew-pursuits", expected: [allowedSidebarDeal] },
    { view: "external-pursuits", expected: [] },
  ])("sends only the sidebar allowlist needed by the $view client screen", async ({ view, expected }) => {
    mocks.listOwned.mockResolvedValue({ repreneur: { id: ownerId, is_demo: false }, opportunities: [{
      ...allowedSidebarDeal, opportunity_id: "00000000-0000-4000-8000-000000000011",
      revenue_meur: 3, ebitda_keur: 400, decline_reason_text: "Private response explanation",
      nda_status: "signed", nda_updated_at: "2026-09-30", visible_documents: ["private-document"],
    }] })
    const page = await StaffPortalPreviewPage({ searchParams: Promise.resolve({ repreneurId: ownerId, workspaceId, view }) })
    const screen = findPursuitsContentProps(page)
    expect(screen).not.toBeNull()
    expect(screen?.deals).toEqual(expected)
    expect(JSON.stringify(screen?.deals)).not.toMatch(/revenue_meur|ebitda_keur|decline_reason_text|nda_status|nda_updated_at|private-document/)
  })
})
