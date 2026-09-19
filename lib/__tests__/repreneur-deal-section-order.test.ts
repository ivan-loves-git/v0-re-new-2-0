import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RepreneurOpportunityList } from "@/components/opportunities/repreneur-opportunity-list"
import type {
  OpportunityMatchStatus,
  RepreneurDealBucket,
  RepreneurDealFlowOpportunity,
} from "@/lib/types/opportunity"

const repreneur = {
  id: "repreneur-1",
  first_name: "Alex",
  last_name: "Martin",
  email: "alex@example.com",
  is_demo: true,
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
})
