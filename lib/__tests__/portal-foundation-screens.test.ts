import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/portal/deals", useSearchParams: () => new URLSearchParams() }))

import { PortalDealsContent } from "@/components/portal/portal-deals-content"
import { PortalProfileContent } from "@/components/portal/portal-profile-content"
import { PortalLoading } from "@/components/portal/portal-loading"
import { LanguageProvider } from "@/lib/i18n/language-context"
import { normalizePortalRepreneurProfile } from "@/lib/data/portal-profile"

const result = { repreneur: { id: "owner-1", first_name: "Ada", last_name: "Example", email: "test@example.test", is_demo: false },
  deals: [], dealFlow: [], staffRecommended: [], automaticMatching: { complete: false, missing: ["sector"] }, demoProfile: false }

function render(language: "en" | "fr", child: React.ReactNode) {
  return renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: language }, child))
}

describe("shared complete portal screens", () => {
  it("preserves incomplete-thesis guidance and owner navigation in the customer Deals screen", () => {
    const html = render("en", createElement(PortalDealsContent, { result, sort: "relevance" }))
    expect(html).toContain("Your deals")
    expect(html).toContain("Deal flow")
    expect(html).toContain("Your current Re-New selections remain available")
    expect(html).toContain('href="/portal/profile#target-thesis"')
  })

  it("uses the same customer heading and DEMO guidance in French preview", () => {
    const html = render("fr", createElement(PortalDealsContent, { result: { ...result, demoProfile: true }, sort: "relevance",
      staffPreview: { profileHref: "/portal-preview?repreneurId=owner-1&view=profile", detailHrefByOpportunityId: {} } }))
    expect(html).toContain("Vos opportunités")
    expect(html).toContain("Profil de démonstration")
    expect(html).not.toContain('href="/portal/')
  })

  it("keeps account preferences personal while sharing the full profile composition", () => {
    const repreneur = normalizePortalRepreneurProfile({ id: "owner-1", first_name: "Ada", last_name: "Example" })
    const html = render("en", createElement(PortalProfileContent, { repreneur, opportunities: [], mode: "staff-preview",
      accountPreferences: createElement("button", null, "Change personal preference") }))
    expect(html).toContain("Target thesis")
    expect(html).toContain("Readiness milestones")
    expect(html).toContain("Account preferences and feedback can only be submitted by the repreneur")
    expect(html).not.toContain("Change personal preference")
    expect(html).not.toContain("Certify as current")
  })

  it("renders accessible translated navigation fallback feedback", () => {
    expect(render("fr", createElement(PortalLoading))).toContain('role="status"')
    expect(render("fr", createElement(PortalLoading))).toContain("Chargement…")
  })
})
