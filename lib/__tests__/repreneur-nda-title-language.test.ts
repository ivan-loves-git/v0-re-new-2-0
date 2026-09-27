import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { RepreneurNdaSignatureUpload } from "@/components/opportunities/repreneur-nda-signature-upload"

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
