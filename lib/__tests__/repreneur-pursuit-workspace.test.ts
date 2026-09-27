import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { RepreneurPursuitWorkspace, filterWorkspaceDeals, type SidebarDeal } from "@/components/portal/repreneur-pursuit-workspace"
import type { RepreneurOpportunityExposure } from "@/lib/types/opportunity"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const opportunity: RepreneurOpportunityExposure = {
  match_id: "own-match", match_status: "proposed", opportunity_id: "opportunity-1",
  public_title: "Original approved title", teaser_summary: "Original approved public description",
  sector: "Industrie manufacturière", activity: "Specialist manufacturing", location: "Île-de-France",
  revenue_meur: 4.8, ebitda_keur: 720, headcount: 34, headcount_range: "30–40",
  date_added_display: "septembre 2026", date_added_display_en: "September 2026",
  visible_documents: [], reference: "Confidential opportunity", updated_at: "2026-09-27T00:00:00Z",
  criteria_comparison: [
    { key: "revenue", outcome: "within_target", target: { min: 3, max: 5 }, actual: 4.8 },
  ],
}
const deals: SidebarDeal[] = [
  { match_id: "own-match", match_status: "proposed", public_title: "Original approved title", sector: "Industrie manufacturière", activity: "Specialist manufacturing", location: "Île-de-France" },
  { match_id: "ended-match", match_status: "dropped", public_title: "Ended title", sector: "Tech & Digital", activity: "Software", location: "Bretagne" },
]

describe("repreneur pursuit workspace", () => {
  it("filters only its authorized sidebar input without changing the selected detail", () => {
    expect(filterWorkspaceDeals(deals, "software", "all").map((deal) => deal.match_id)).toEqual(["ended-match"])
    expect(filterWorkspaceDeals(deals, "", "awaiting").map((deal) => deal.match_id)).toEqual(["own-match"])
    expect(filterWorkspaceDeals(deals, "", "active")).toEqual([])
  })

  it("renders the selected safe detail, current action and approved original text", () => {
    const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" },
      createElement(RepreneurPursuitWorkspace, {
        opportunity, deals, actions: { "own-match": "respond", "ended-match": null }, journey: null,
      })))
    expect(html).toContain('data-wave-workspace="pursuit"')
    expect(html).toContain("Original approved public description")
    expect(html).toContain("4.8 M EUR")
    expect(html).toContain("Your action")
    expect(html).toContain('data-action-avatar="true"')
    expect(html).not.toContain("staff-secret")
    expect(html).not.toContain("source_firm_id")
  })

  it("keeps an eligible discovery-only detail actionable without adding it to matched pursuits", () => {
    const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" },
      createElement(RepreneurPursuitWorkspace, {
        opportunity: { ...opportunity, match_id: null, match_status: null, is_staff_recommended: false, is_outside_current_criteria: false },
        deals: [], actions: {}, journey: null,
      })))
    expect(html).toContain("Original approved public description")
    expect(html).toContain("Express interest")
    expect(html).toContain('data-wave-action="express_interest"')
    expect(html).toContain("0 pursuits in this view")
    expect(html).not.toContain('href="/portal/deals/own-match"')
  })
})
