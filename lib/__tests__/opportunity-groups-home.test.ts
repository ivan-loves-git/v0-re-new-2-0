import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  pathname: "/opportunities/groups",
  redirect: vi.fn((_destination: string): never => {
    throw new Error("NEXT_REDIRECT")
  }),
  listOpportunities: vi.fn(async () => []),
  listOpportunityWorkSurfaceRecords: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  usePathname: () => mocks.pathname,
  useRouter: () => ({ prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/actions/opportunities", () => ({
  archiveOpportunity: vi.fn(),
  listOpportunities: mocks.listOpportunities,
  listOpportunityWorkSurfaceRecords: mocks.listOpportunityWorkSurfaceRecords,
}))
vi.mock("@/lib/actions/opportunity-export", () => ({
  listOpportunityExportRows: vi.fn(),
}))
vi.mock("@/lib/actions/opportunity-full-export", () => ({
  exportFullOpportunityCsv: vi.fn(),
}))

import OpportunitiesPage from "@/app/(dashboard)/opportunities/page"
import OpportunityGroupsPage from "@/app/(dashboard)/opportunities/groups/page"
import { FloatingNav } from "@/components/floating-nav"
import { SidebarProvider } from "@/components/ui/sidebar"

beforeEach(() => {
  vi.clearAllMocks()
})

function breadcrumbFor(pathname: string) {
  mocks.pathname = pathname
  const html = renderToStaticMarkup(
    createElement(SidebarProvider, null, createElement(FloatingNav)),
  )
  return html.match(/<nav\b[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? ""
}

describe("staff opportunity home", () => {
  it("takes an old Opportunities bookmark straight to Groups without loading the retired table", () => {
    expect(() => OpportunitiesPage()).toThrow("NEXT_REDIRECT")
    expect(mocks.redirect).toHaveBeenCalledWith("/opportunities/groups")
    expect(mocks.listOpportunities).not.toHaveBeenCalled()
  })

  it("shows both staff downloads beside creation above the existing Groups surface", async () => {
    mocks.listOpportunityWorkSurfaceRecords.mockResolvedValueOnce([{
      id: "synthetic-opportunity",
      reference: "SYNTHETIC-178",
      status: "active",
      is_demo: false,
      repreneur_exposure: "staff_only",
      created_at: "2026-09-23T08:00:00.000Z",
      updated_at: "2026-09-23T08:00:00.000Z",
      matches: [],
      source_review_required: false,
    }])
    const html = renderToStaticMarkup(await OpportunityGroupsPage())
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? ""

    expect(header).toContain("Export staff CSV")
    expect(header).toContain("Full export")
    expect(header).toContain('href="/opportunities/new"')
    expect(header).toContain("New opportunity")
    expect(html).toContain("Live inventory")
  })

  it("links the opportunity root of Find, creation and pursuit breadcrumbs to Groups", () => {
    for (const [pathname, leaf] of [
      ["/opportunities/find", "Find"],
      ["/opportunities/new", "New"],
      ["/opportunities/pursuits", "External pursuits"],
    ]) {
      const breadcrumb = breadcrumbFor(pathname)
      expect(breadcrumb).toMatch(/href="\/opportunities\/groups"[^>]*>Opportunities<\/a>/)
      expect(breadcrumb).toContain(`>${leaf}</span>`)
    }
  })

  it("keeps the M&A detail breadcrumb hierarchy with Groups as its opportunity root", () => {
    const breadcrumb = breadcrumbFor(
      "/opportunities/ma/firms/11111111-1111-4111-8111-111111111111",
    )

    expect(breadcrumb).toMatch(/href="\/opportunities\/groups"[^>]*>Opportunities<\/a>/)
    expect(breadcrumb).toContain('href="/opportunities/ma"')
    expect(breadcrumb).toContain('href="/opportunities/ma/firms"')
    expect(breadcrumb).toContain(">Firm detail</span>")
  })

  it("keeps direct opportunity details reachable beneath the Groups breadcrumb", () => {
    const breadcrumb = breadcrumbFor(
      "/opportunities/11111111-1111-4111-8111-111111111111",
    )

    expect(breadcrumb).toMatch(/href="\/opportunities\/groups"[^>]*>Opportunities<\/a>/)
    expect(breadcrumb).toContain(">Opportunity detail</span>")
  })
})
