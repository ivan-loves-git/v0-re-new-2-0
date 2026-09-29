import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { publicDealOutcome } from "@/lib/i18n/deal-outcomes"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const deal: RepreneurDealFlowOpportunity = {
  opportunity_id: "opportunity-1",
  match_id: "match-1",
  match_status: "proposed",
  deal_bucket: "recommended",
  public_title: "Original Seller Title",
  teaser_summary: "Original approved description",
  sector: "Original custom sector",
  location: "Original staff geography",
  date_added_display: "septembre 2026",
  date_added_display_en: "September 2026",
  revenue_meur: 1.5,
  visible_documents: [],
  reference: "REF-1",
  updated_at: "2026-09-20T10:00:00Z",
  is_staff_recommended: true,
  is_outside_current_criteria: false,
}

function render(language: "fr" | "en", detail: boolean) {
  return renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: language },
      detail
        ? createElement(RepreneurOpportunityDetail, { opportunity: deal, readOnly: true })
        : createElement(RepreneurOpportunityList, {
          repreneur: { id: "owner-1", first_name: "Alex", last_name: "Martin", email: "alex@example.com", is_demo: false },
          opportunities: [deal], readOnly: true,
        })),
  )
}

describe("repreneur deal interface locale", () => {
  it("renders list and detail in French or English while preserving original content and month precision", () => {
    for (const detail of [false, true]) {
      const french = render("fr", detail)
      const english = render("en", detail)
      expect(french).toContain("Original Seller Title")
      expect(english).toContain("Original Seller Title")
      expect(french).toContain("Original approved description")
      expect(english).toContain("Original approved description")
      expect(french).toContain("Original custom sector")
      expect(english).toContain("Original custom sector")
      expect(french).toContain("septembre 2026")
      expect(english).toContain("September 2026")
      expect(french).not.toContain("01 septembre")
      expect(english).not.toContain("01 September")
    }
    expect(render("fr", false)).toContain("Recommandées")
    expect(render("en", false)).toContain("Recommended")
    expect(render("fr", true)).toContain(">Réponse</h2>")
    expect(render("en", true)).toContain(">Response</h2>")
  })

  it("shows only controlled public action messages", () => {
    expect(publicDealOutcome("choose this reason", "fr", "We could not save your response right now. Please try again."))
      .toBe("Impossible d’enregistrer votre réponse pour le moment. Réessayez.")
    expect(publicDealOutcome("raw provider connection string", "en", "The signed NDA could not be uploaded."))
      .toBe("The signed NDA could not be uploaded.")
    expect(publicDealOutcome("Your interest was withdrawn before Re-New validation. This opportunity remains available if eligible.", "fr", "The withdrawal could not be confirmed right now. Please try again."))
      .toContain("avant sa validation par Re-New")
  })
})
