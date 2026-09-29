import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { RepreneurNdaSignatureUpload } from "@/components/opportunities/repreneur-nda-signature-upload"
import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import type { PortalCurrentPursuit } from "@/lib/data/current-pursuit"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe("repreneur NDA title", () => {
  it("seeds a localized editable title without changing document or upload rules", () => {
    const render = (language: "fr" | "en") => renderToStaticMarkup(
      createElement(LanguageProvider, { initialLanguage: language },
        createElement(RepreneurNdaSignatureUpload, { matchId: "match-1" })),
    )
    const french = render("fr")
    const english = render("en")
    expect(french).toContain('name="title"')
    expect(french).toContain('value="NDA signé par le repreneur"')
    expect(english).toContain('value="NDA signed by repreneur"')
    expect(french).toContain('accept="application/pdf,.pdf"')
  })
})

describe("current NDA documents state", () => {
  const opportunity: RepreneurDealFlowOpportunity = {
    opportunity_id: "opportunity-1",
    match_id: "match-1",
    match_status: "active_pursuit",
    reference: "QA-188",
    public_title: "Synthetic pursuit",
    visible_documents: [],
    updated_at: "2026-09-27T00:00:00.000Z",
    is_staff_recommended: false,
    is_outside_current_criteria: false,
  }
  const journey: PortalCurrentPursuit = {
    matchId: "match-1", enabled: true, ndaReadyNotified: true, revoked: false,
    projectionUnavailable: false, action: null, signedCopyState: "not_submitted",
    sourceDisclosureCurrent: false, confidentialGrant: null,
    history: { currentCycleRecorded: true, previousCycleEnded: false,
      ndaReadyNoticeRecorded: true, currentSubmissionRecorded: false, accessEnded: false },
  }
  const render = (signedCopyState: PortalCurrentPursuit["signedCopyState"], language: "fr" | "en" = "en") => renderToStaticMarkup(
    createElement(LanguageProvider, { initialLanguage: language },
      createElement(RepreneurOpportunityDetail, {
        opportunity, mode: "documents", journey: { ...journey, signedCopyState },
      })),
  )

  it.each([
    { state: "not_submitted", en: "Your NDA is ready. Upload your signed copy", fr: "Votre NDA est prêt à être signé.", upload: true, template: true },
    { state: "awaiting_validation", en: "Your signed NDA has been received and is awaiting Re-New validation.", fr: "Votre NDA signé a été reçu et attend la validation de Re-New.", upload: false, template: true },
    { state: "validated", en: "Your signed NDA has been validated.", fr: "Votre NDA signé a été validé.", upload: false, template: true },
    { state: "unknown", en: "The signed NDA status is unavailable.", fr: "Le statut du NDA signé est indisponible.", upload: false, template: false },
  ] as const)("renders the $state document state in English and French", ({ state, en, fr, upload, template }) => {
    for (const [language, expected] of [["en", en], ["fr", fr]] as const) {
      const html = render(state, language)
      expect(html).toContain(expected)
      if (upload) {
        expect(html).toContain('id="signed-nda-title"')
        expect(html).toContain(language === "en" ? "Use this exact validated template for your signed copy." : "Utilisez ce modèle validé précis pour votre copie signée.")
      } else {
        expect(html).not.toContain('id="signed-nda-title"')
        expect(html).not.toContain(language === "en" ? "Your NDA is ready. Upload your signed copy" : "Votre NDA est prêt à être signé.")
      }
      if (template) {
        expect(html).toContain(language === "en" ? "Download template" : "Télécharger le modèle")
        if (!upload) expect(html).toContain(language === "en" ? "This validated NDA template remains available for reference." : "Ce modèle de NDA validé reste disponible pour consultation.")
      } else {
        expect(html).not.toContain(language === "en" ? "Download template" : "Télécharger le modèle")
      }
      if (state === "awaiting_validation") {
        expect(html).toContain('role="status"')
        expect(html).toContain(language === "en" ? "Your signed NDA has been received for staff validation." : "Votre NDA signé a été reçu pour validation par l’équipe.")
      }
    }
  })
})
