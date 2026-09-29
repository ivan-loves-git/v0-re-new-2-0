import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/emails/automations/opportunity-freshness",
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { FloatingNav } from "@/components/floating-nav"
import { SidebarProvider } from "@/components/ui/sidebar"

describe("opportunity freshness breadcrumb", () => {
  it("links only the real Emails ancestor and names the current rule clearly", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(FloatingNav)),
    )
    const breadcrumb = html.match(/<nav\b[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? ""

    expect(breadcrumb).toContain('href="/emails"')
    expect(breadcrumb).not.toContain('href="/emails/automations"')
    expect(breadcrumb).toContain('aria-current="page"')
    expect(breadcrumb).toContain('>Opportunity freshness</span>')
    expect(breadcrumb).not.toContain('>Automations</a>')
  })
})
