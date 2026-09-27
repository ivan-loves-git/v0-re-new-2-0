import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-client", () => ({ signIn: { email: vi.fn() } }))
vi.mock("@/lib/actions/waitlist", () => ({ submitWaitlistRequest: vi.fn() }))
vi.mock("@/lib/telemetry/runtime", () => ({ captureWaveEvent: vi.fn() }))

import LoginPage from "@/app/auth/login/page"
import { GlobalSkipLink } from "@/components/i18n/global-skip-link"
import { LanguageProvider } from "@/lib/i18n/language-context"

function renderLogin() {
  return renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" }, createElement(LoginPage)))
}

describe("login before hydration", () => {
  it("keeps native credential submission out of the URL", () => {
    const html = renderLogin()
    const form = html.match(/<form\b[^>]*>/)?.[0]

    // A missing method defaults to GET before React can prevent submission.
    expect(form).toContain('method="post"')
  })

  it("renders Sign In unavailable until its handler is ready", () => {
    const html = renderLogin()
    const submit = html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]

    expect(submit).toContain('disabled=""')
  })

  it("renders the French skip link with French login before hydration while staff keeps English", () => {
    const french = renderToStaticMarkup(createElement(LanguageProvider,
      { initialLanguage: "fr", showSkipLink: true }, createElement(LoginPage)))
    const staff = renderToStaticMarkup(createElement(GlobalSkipLink))

    expect(french).toContain('lang="fr" data-localized-skip-link=""')
    expect(french).toContain("Aller au contenu principal")
    expect(french).toContain("Se connecter")
    expect(staff).toContain('lang="en" data-root-skip-link=""')
    expect(staff).toContain("Skip to main content")
  })
})
