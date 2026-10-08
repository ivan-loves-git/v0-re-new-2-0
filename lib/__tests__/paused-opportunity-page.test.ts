import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

const mocks = vi.hoisted(() => ({ detail: vi.fn(), matches: vi.fn(), ordinary: vi.fn(), journey: vi.fn(), actions: vi.fn() }))
vi.mock("next/server", () => ({ connection: async () => {} }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found") }, useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/repreneur-opportunities", () => ({ getMyRepreneurOpportunity: mocks.detail,
  listMyRepreneurOpportunities: mocks.matches, listMyRepreneurDealFlow: mocks.ordinary }))
vi.mock("@/lib/data/current-pursuit", () => ({ readPortalCurrentPursuit: mocks.journey, readPortalDealActionIndicators: mocks.actions }))
vi.mock("@/lib/interest-withdrawal-operations", () => ({ interestWithdrawalOperationsPaused: () => false }))
import PortalDealDetailPage from "@/app/portal/deals/[matchId]/page"

const active: RepreneurDealFlowOpportunity = { opportunity_id: "active-opportunity", opportunity_status: "active", match_id: "active-match", match_status: "proposed",
  reference: "Confidential opportunity", public_title: "Active ordinary entry", updated_at: "2026-10-07T10:00:00Z", visible_documents: [],
  is_staff_recommended: true, is_outside_current_criteria: false,
  personal_review: { viewed: true, reviewed: false } }
const paused: RepreneurDealFlowOpportunity = { ...active, opportunity_id: "actual-visit", opportunity_status: "paused", match_id: null,
  match_status: null, public_title: "Own Paused visit", personal_review: undefined }
async function render(search: Record<string, string> = {}) {
  const element = await PortalDealDetailPage({ params: Promise.resolve({ matchId: active.match_id! }), searchParams: Promise.resolve(search) })
  return renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" }, element))
}

describe("Paused ordinary detail navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.detail.mockResolvedValue(active)
    mocks.matches.mockResolvedValue({ opportunities: [active] })
    mocks.ordinary.mockResolvedValue({ deals: [active, paused] })
    mocks.journey.mockResolvedValue(null)
    mocks.actions.mockResolvedValue({ "active-match": "respond" })
  })
  it("retains ordinary Paused navigation while a selected Active detail keeps its personal and response controls", async () => {
    const html = await render()
    expect(html).toContain("Own Paused visit")
    expect(html).toContain('href="/portal/deals/actual-visit"')
    expect(html).toContain("Mark as reviewed")
    expect(html).toContain('data-wave-action="express_interest"')
    expect(mocks.actions).toHaveBeenCalledWith(["active-match"])
  })
  it("preserves the explicit current-pursuits work view and excludes historical entries", async () => {
    expect(await render({ return: "/portal/pursuits" })).not.toContain("Own Paused visit")
    expect(mocks.ordinary).not.toHaveBeenCalled()
  })
  it("never loads a current journey or action for the selected Paused history", async () => {
    mocks.detail.mockResolvedValue(paused)
    const html = await render()
    expect(html).toContain("Paused")
    expect(html).not.toContain("Mark as reviewed")
    expect(html).not.toContain('data-wave-action="express_interest"')
    expect(mocks.journey).not.toHaveBeenCalled()
    expect(mocks.actions).toHaveBeenCalledWith(["active-match"])
  })
  it("returns not-found for a denied detail before loading ordinary navigation or action capabilities", async () => {
    mocks.detail.mockResolvedValue(null)
    await expect(render()).rejects.toThrow("not-found")
    expect(mocks.ordinary).not.toHaveBeenCalled()
    expect(mocks.journey).not.toHaveBeenCalled()
    expect(mocks.actions).not.toHaveBeenCalled()
  })
})
