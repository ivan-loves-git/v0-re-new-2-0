import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listOpportunities: vi.fn(),
  getOpportunity: vi.fn(),
  listExternal: vi.fn(),
  listLegacyBoard: vi.fn(),
  getAttachments: vi.fn(),
  readActions: vi.fn(),
  readNextActions: vi.fn(),
}))

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/repreneur-opportunities", () => ({
  listMyRepreneurOpportunities: mocks.listOpportunities,
  getMyRepreneurOpportunity: mocks.getOpportunity,
}))
vi.mock("@/lib/actions/external-pursuits", () => ({ listExternalPursuitBoard: mocks.listExternal }))
vi.mock("@/lib/actions/external-pursuit-board", () => ({ listPortalReNewPursuitBoard: mocks.listLegacyBoard }))
vi.mock("@/lib/actions/external-pursuit-attachments", () => ({ getExternalPursuitAttachmentMap: mocks.getAttachments }))
vi.mock("@/lib/data/current-pursuit", () => ({ readPortalDealActionIndicators: mocks.readActions }))
vi.mock("@/lib/data/portal-next-actions", () => ({ readPortalNextActions: mocks.readNextActions }))

import PortalPursuitsPage from "@/app/portal/pursuits/page"
import PortalDealDetailPage from "@/app/portal/deals/[matchId]/page"

describe("owner Pursuits entry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listOpportunities.mockResolvedValue({ repreneur: { id: "owner-1" }, opportunities: [{
      match_id: "match-1", match_status: "proposed", opportunity_id: "opportunity-1",
      public_title: "Safe selected match", sector: "Industrie", activity: "Manufacturing",
      location: "France", visible_documents: [], recommendation_expires_at: null,
    }] })
    mocks.listExternal.mockResolvedValue([])
    mocks.listLegacyBoard.mockResolvedValue([])
    mocks.getAttachments.mockResolvedValue({})
    mocks.readActions.mockResolvedValue({ "match-1": "respond" })
    mocks.readNextActions.mockResolvedValue({ state: "ready", asOf: "2026-09-30T00:00:00Z",
      yourActions: [], waiting: [], resources: [] })
    mocks.getOpportunity.mockResolvedValue({
      match_id: "match-1", match_status: "proposed", opportunity_id: "opportunity-1",
      public_title: "Safe selected match", teaser_summary: "Approved public description",
      sector: "Industrie", activity: "Manufacturing", location: "France", visible_documents: [],
      recommendation_expires_at: null,
    })
  })

  it("opens the matched list workspace from the normal Pursuits route without opening a detail", async () => {
    const html = renderToStaticMarkup(await PortalPursuitsPage({ searchParams: Promise.resolve({}) }))

    expect(html).toContain('data-wave-workspace="pursuit"')
    expect(html).toContain("Safe selected match")
    expect(html).toContain("Search pursuits")
    expect(html).toContain('href="/portal/deals/match-1?return=%2Fportal%2Fpursuits"')
    expect(html).toContain('href="/portal/pursuits?view=external"')
    expect(html).not.toContain("Approved public description")
    expect(mocks.readActions).toHaveBeenCalledWith(["match-1"])
    expect(mocks.readNextActions).toHaveBeenCalledWith({ kind: "portal" }, expect.any(Object), { indicators: { "match-1": "respond" } })
    expect(mocks.listExternal).not.toHaveBeenCalled()
    expect(mocks.listLegacyBoard).not.toHaveBeenCalled()
  })

  it("returns a selected match to the filtered Pursuits entry without accepting arbitrary return URLs", async () => {
    const page = await PortalDealDetailPage({
      params: Promise.resolve({ matchId: "match-1" }),
      searchParams: Promise.resolve({ q: "metal", status: "awaiting", return: "/portal/pursuits" }),
    })
    const html = renderToStaticMarkup(page)

    expect(html).toContain('href="/portal/pursuits?q=metal&amp;status=awaiting"')
    expect(html).toContain("Approved public description")

    const invalidPage = await PortalDealDetailPage({
      params: Promise.resolve({ matchId: "match-1" }),
      searchParams: Promise.resolve({ return: "//outside.example" }),
    })
    const invalidHtml = renderToStaticMarkup(invalidPage)
    expect(invalidHtml).toContain('href="/portal/deals"')
    expect(invalidHtml).not.toContain("outside.example")
  })

  it("keeps External dossiers in an explicit separate view with their existing controls", async () => {
    mocks.readNextActions.mockResolvedValue({ state: "unavailable", asOf: "2026-09-30T00:00:00Z",
      yourActions: [], waiting: [], resources: [] })
    const html = renderToStaticMarkup(await PortalPursuitsPage({ searchParams: Promise.resolve({ view: "external" }) }))

    expect(html).toContain('href="/portal/pursuits"')
    expect(html).toContain("New external pursuit")
    expect(html).toContain('aria-label="Pursuit board"')
    expect(html).toContain("External dossiers remain separate from Re-New pursuits.")
    expect(html).toContain("Current actions are unavailable")
    expect(html).not.toContain("Re-New cards are a read-only view")
    expect(html).not.toContain('data-wave-workspace="pursuit"')
    expect(mocks.listExternal).toHaveBeenCalledOnce()
    expect(mocks.listOpportunities).toHaveBeenCalledOnce()
    expect(mocks.readNextActions).toHaveBeenCalledWith({ kind: "portal" }, expect.any(Object), { external: [] })
    expect(mocks.readActions).not.toHaveBeenCalled()
  })

  it("keeps the authorized External board available when its optional owned-match summary fails", async () => {
    mocks.listOpportunities.mockRejectedValue(new Error("Owned match summary unavailable"))
    const html = renderToStaticMarkup(await PortalPursuitsPage({ searchParams: Promise.resolve({ view: "external" }) }))
    expect(html).toContain('aria-label="Pursuit board"')
    expect(html).toContain("New external pursuit")
    expect(html).toContain("Current actions are unavailable")
    expect(mocks.readNextActions).not.toHaveBeenCalled()
  })

  it("does not conceal a required External board read failure", async () => {
    mocks.listExternal.mockRejectedValue(new Error("External board denied"))
    await expect(PortalPursuitsPage({ searchParams: Promise.resolve({ view: "external" }) })).rejects.toThrow("External board denied")
  })
})
