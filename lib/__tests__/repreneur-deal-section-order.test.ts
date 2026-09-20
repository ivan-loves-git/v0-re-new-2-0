import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { RepreneurOpportunityDetail } from "@/components/opportunities/repreneur-opportunity-detail"
import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import { RepreneurProfileSummary } from "@/components/portal/repreneur-profile-summary"
import type { PortalRepreneurProfile } from "@/lib/data/portal-profile"
import type {
  OpportunityMatchStatus,
  RepreneurDealBucket,
  RepreneurDealFlowOpportunity,
} from "@/lib/types/opportunity"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const repreneur = {
  id: "repreneur-1",
  first_name: "Alex",
  last_name: "Martin",
  email: "alex@example.com",
  is_demo: true,
}

const portalProfile: PortalRepreneurProfile = {
  id: "repreneur-1",
  first_name: "Alex",
  last_name: "Martin",
  q13_target_sectors_v2: [],
  sector_preferences: [],
  q12_geo_zones: [],
  target_location: [],
  q14_deal_size: [],
  target_acquisition_size: null,
  q16_equity: null,
  q14_investment_capacity: null,
  investment_capacity: null,
  target_revenue_min_meur: null,
  target_revenue_max_meur: null,
  target_ebitda_min_keur: null,
  target_ebitda_max_keur: null,
  target_ebitda_margin_min_pct: null,
  target_staff_size_min: null,
  target_staff_size_max: null,
  ldc_url: null,
  ldc_self_certified_at: null,
  advisory_team_self_certified_at: null,
  ms_ldc_validated: false,
  ms_advisory_team: false,
}

function deal(
  id: string,
  bucket: RepreneurDealBucket,
  status: OpportunityMatchStatus | null,
): RepreneurDealFlowOpportunity {
  return {
    match_id: bucket === "live" ? null : `match-${id}`,
    match_status: status,
    visible_documents: [],
    opportunity_id: `opportunity-${id}`,
    reference: `OPP-${id}`,
    public_title: `Deal ${id}`,
    updated_at: "2026-09-19T00:00:00.000Z",
    is_staff_recommended: bucket === "recommended",
    is_outside_current_criteria: false,
    recommendation_expires_at: bucket === "recommended" ? "2099-09-19T00:00:00.000Z" : null,
    deal_bucket: bucket,
  }
}

function renderList(opportunities: RepreneurDealFlowOpportunity[], readOnly = false) {
  const detailHrefByOpportunityId = Object.fromEntries(opportunities.map((opportunity) => [
    opportunity.match_id ?? opportunity.opportunity_id,
    `/test-deals/${opportunity.opportunity_id}`,
  ]))

  return renderToStaticMarkup(createElement(RepreneurOpportunityList, {
    repreneur,
    opportunities,
    detailHrefByOpportunityId,
    readOnly,
  }))
}

function sectionHeadings(html: string) {
  return Array.from(
    html.matchAll(/<h2 id="deal-section-[^"]+"[^>]*>([^<]+)<\/h2>/g),
    (match) => match[1],
  )
}

function sectionHtml(html: string, sectionKey: string) {
  const match = html.match(new RegExp(`<section[^>]*aria-labelledby="deal-section-${sectionKey}"[\\s\\S]*?<\\/section>`))
  expect(match, `expected ${sectionKey} section`).not.toBeNull()
  return match?.[0] ?? ""
}

describe("repreneur Deal Flow section order", () => {
  it("renders mixed Deal Flow states in the approved order without changing records, ranking, links or actions", () => {
    const opportunities = [
      deal("recommended-b", "recommended", "proposed"),
      deal("declined", "declined", "declined"),
      deal("progress-a", "in_progress", "interested"),
      deal("live", "live", null),
      deal("recommended-a", "recommended", "proposed"),
      deal("progress-b", "in_progress", "active_pursuit"),
    ]
    const html = renderList(opportunities)
    const staffPreviewHtml = renderList(opportunities, true)

    const approvedOrder = [
      "Recommended",
      "In Progress",
      "Live Opportunities",
      "Declined",
    ]

    for (const renderedList of [html, staffPreviewHtml]) {
      expect(sectionHeadings(renderedList)).toEqual(approvedOrder)
      expect(sectionHtml(renderedList, "recommended")).toMatch(/Deal recommended-b[\s\S]*Deal recommended-a/)
      expect(sectionHtml(renderedList, "in-progress")).toMatch(/Deal progress-a[\s\S]*Deal progress-b/)
      expect(sectionHtml(renderedList, "live-opportunities")).toContain("Deal live")
      expect(sectionHtml(renderedList, "declined")).toContain("Deal declined")

      for (const opportunity of opportunities) {
        expect(renderedList.match(new RegExp(`Deal ${opportunity.opportunity_id.replace("opportunity-", "")}`, "g"))).toHaveLength(1)
        expect(renderedList).toContain(`href="/test-deals/${opportunity.opportunity_id}"`)
      }
      expect(sectionHtml(renderedList, "declined")).toContain("Review and reconsider")
      expect(renderedList).toContain('aria-label="Deal flow filters"')
      expect(renderedList.match(/Respond by:/g)).toHaveLength(2)
    }

    expect(html).toContain("Region and sector choices are saved in this browser only.")
    expect(staffPreviewHtml).toContain("Staff preview does not read or save repreneur preferences.")
  })

  it("omits empty buckets while retaining the approved relative order", () => {
    const html = renderList([
      deal("recommended", "recommended", "proposed"),
      deal("declined", "declined", "declined"),
      deal("live", "live", null),
    ])

    expect(sectionHeadings(html)).toEqual([
      "Recommended",
      "Live Opportunities",
      "Declined",
    ])
    expect(html).not.toContain('id="deal-section-in-progress"')
  })

  it("hides automatic Fit, the portal reference filler and decorative positions across shared repreneur views", () => {
    const namedOpportunity = {
      ...deal("named", "recommended", "proposed"),
      reference: "Confidential opportunity",
      public_title: "Public industrial services opportunity",
      teaser_summary: "Public description retained for the repreneur.",
      relevance_grade: "strong_fit" as const,
    }
    const untitledOpportunity = {
      ...deal("untitled", "recommended", "proposed"),
      reference: "Confidential opportunity",
      public_title: null,
      sector: null,
      activity: null,
      teaser_summary: "Public fallback description retained.",
      relevance_grade: "possible_fit" as const,
    }
    const listHtml = renderList([namedOpportunity, untitledOpportunity])
    const previewHtml = renderList([namedOpportunity, untitledOpportunity], true)
    const detailHtml = renderToStaticMarkup(createElement(RepreneurOpportunityDetail, {
      opportunity: untitledOpportunity,
      readOnly: true,
    }))
    const profileHtml = renderToStaticMarkup(createElement(RepreneurProfileSummary, {
      repreneur: portalProfile,
      opportunities: [untitledOpportunity],
    }))

    for (const renderedView of [listHtml, previewHtml, detailHtml, profileHtml]) {
      expect(renderedView).not.toContain("Confidential opportunity")
      expect(renderedView).not.toContain("Re-New ref")
      expect(renderedView).not.toContain("Fit:")
      expect(renderedView).not.toContain("Strong fit")
      expect(renderedView).not.toContain('aria-label="Position')
    }

    expect(listHtml).toContain("Public industrial services opportunity")
    expect(listHtml).toContain("Public description retained for the repreneur.")
    expect(listHtml).toContain("Confidential acquisition opportunity")
    expect(detailHtml).toContain("Confidential acquisition opportunity")
    expect(detailHtml).toContain("Public fallback description retained.")
    expect(profileHtml).toContain("Confidential acquisition opportunity")
    expect(profileHtml).toContain("Public fallback description retained.")
  })
})


describe("#157 personal review presentation", () => {
  it("moves reviewed items only within Recommended and Live, preserving other ordering", () => {
    const items = [
      { ...deal("r-reviewed", "recommended", "proposed"), personal_review: { viewed: true, reviewed: true } },
      { ...deal("r-unreviewed", "recommended", "proposed"), personal_review: { viewed: true, reviewed: false } },
      { ...deal("p-reviewed", "in_progress", "active_pursuit"), personal_review: { viewed: true, reviewed: true } },
      { ...deal("p-unreviewed", "in_progress", "interested"), personal_review: { viewed: false, reviewed: false } },
      { ...deal("l-reviewed", "live", null), personal_review: { viewed: true, reviewed: true } },
      { ...deal("l-unreviewed", "live", null), personal_review: { viewed: false, reviewed: false } },
      { ...deal("d-reviewed", "declined", "declined"), personal_review: { viewed: true, reviewed: true } },
      { ...deal("d-unreviewed", "declined", "declined"), personal_review: { viewed: false, reviewed: false } },
    ]
    const html = renderList(items)
    expect(sectionHeadings(html)).toEqual(["Recommended", "In Progress", "Live Opportunities", "Declined"])
    for (const prefix of ["r", "l"]) expect(html.indexOf(`Deal ${prefix}-unreviewed`)).toBeLessThan(html.indexOf(`Deal ${prefix}-reviewed`))
    for (const prefix of ["p", "d"]) expect(html.indexOf(`Deal ${prefix}-reviewed`)).toBeLessThan(html.indexOf(`Deal ${prefix}-unreviewed`))
    expect(html).toContain("Not yet viewed")
    expect(html).toContain("Viewed")
    expect(html).toContain("Reviewed")
  })

  it("omits personal indicators and actions in staff preview even if supplied personal state", () => {
    const reviewed = { ...deal("reviewed", "recommended", "proposed"), personal_review: { viewed: true, reviewed: true } }
    const unopened = { ...deal("unopened", "live", null), personal_review: { viewed: false, reviewed: false } }
    const list = renderList([reviewed, unopened], true)
    const detail = renderToStaticMarkup(createElement(RepreneurOpportunityDetail, { opportunity: reviewed, readOnly: true }))
    for (const html of [list, detail]) {
      expect(html).not.toContain("Undo reviewed")
      expect(html).not.toContain("Mark as reviewed")
      expect(html).not.toContain("Not yet viewed")
      expect(html).not.toContain("Reviewed ·")
    }
  })
})
