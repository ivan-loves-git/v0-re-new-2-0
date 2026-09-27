import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { LanguageProvider } from "@/lib/i18n/language-context"

const mocks = vi.hoisted(() => ({ pathname: vi.fn(), searchParams: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname, useSearchParams: mocks.searchParams }))

import { PortalShell } from "@/components/portal/portal-shell"

describe("portal navigation context", () => {
  it("keeps Pursuits selected while viewing a matched detail opened from Pursuits", () => {
    mocks.pathname.mockReturnValue("/portal/deals/match-1")
    mocks.searchParams.mockReturnValue(new URLSearchParams("return=%2Fportal%2Fpursuits&q=metal&status=awaiting"))

    const html = renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: "en" },
      createElement(PortalShell, null, "Safe detail")))

    const pursuitsLink = html.match(/<a[^>]*aria-label="Pursuits"[^>]*>/)?.[0]
    const dealsLink = html.match(/<a[^>]*aria-label="Deals"[^>]*>/)?.[0]
    expect(pursuitsLink).toContain('aria-current="page"')
    expect(pursuitsLink).toContain('href="/portal/pursuits?q=metal&amp;status=awaiting"')
    expect(dealsLink).not.toContain('aria-current="page"')
  })
})
