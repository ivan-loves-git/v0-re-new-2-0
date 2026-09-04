import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { IntakeProgress } from "@/components/intake-v2/intake-form-v2"
import { DealSection } from "@/components/opportunities/repreneur-opportunity-list"
import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

const deal: RepreneurDealFlowOpportunity = {
  match_id: null,
  match_status: null,
  visible_documents: [],
  opportunity_id: "opportunity-1",
  reference: "OPP-001",
  public_title: "A manufacturing business",
  updated_at: "2026-09-04T00:00:00.000Z",
  is_staff_recommended: false,
  is_outside_current_criteria: false,
}

describe("opening accessibility semantics", () => {
  it("renders unique whitespace-free Deal Flow heading IDs that each resolve exactly once", () => {
    const sections = [
      ["recommended", "Recommended"],
      ["declined", "Declined"],
      ["in-progress", "In Progress"],
      ["live-opportunities", "Live Opportunities"],
    ] as const
    const html = renderToStaticMarkup(createElement("div", null, ...sections.map(([sectionKey, title]) => createElement(DealSection, {
      sectionKey,
      title,
      description: "Available opportunities.",
      opportunities: [deal],
      detailHrefForOpportunity: () => "/portal/deals/opportunity-1",
      detailLabel: "View detail",
      readOnly: false,
    }))))

    const labelledBy = Array.from(html.matchAll(/<section[^>]*aria-labelledby="([^"]+)"/g), (match) => match[1])
    expect(labelledBy).toEqual([
      "deal-section-recommended",
      "deal-section-declined",
      "deal-section-in-progress",
      "deal-section-live-opportunities",
    ])
    expect(new Set(labelledBy)).toHaveLength(labelledBy.length)
    for (const headingId of labelledBy) {
      expect(headingId).not.toMatch(/\s/)
      expect(html.match(new RegExp(`<h2 id="${headingId}"`, "g"))).toHaveLength(1)
    }
  })

  it("renders a complete localized progress value for strategic intake", () => {
    const html = renderToStaticMarkup(createElement(IntakeProgress, {
      currentStep: 3,
      language: "en",
    }))

    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-label="Form progress"')
    expect(html).toContain('aria-valuemin="1"')
    expect(html).toContain('aria-valuemax="6"')
    expect(html).toContain('aria-valuenow="3"')
    expect(html).toContain('aria-valuetext="Step 3 of 6"')
    expect(html).toContain('transform:translateX(-50%)')
  })

  it("localizes the progress label and step value in French", () => {
    const html = renderToStaticMarkup(createElement(IntakeProgress, {
      currentStep: 6,
      language: "fr",
    }))

    expect(html).toContain('aria-label="Progression du formulaire"')
    expect(html).toContain('aria-valuetext="Étape 6 sur 6"')
  })
})
