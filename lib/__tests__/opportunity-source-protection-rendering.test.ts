import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("better-auth", () => ({ betterAuth: () => ({ api: {} }) }))
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({}) }))
vi.mock("pg", () => ({ Pool: class {} }))

import { OpportunityForm } from "@/components/opportunities/opportunity-form"
import type {
  MaOfficeIntakeOffice,
  OpportunityWithSource,
} from "@/lib/types/opportunity"

const officeId = "22222222-2222-4222-8222-222222222222"
const affiliationId = "33333333-3333-4333-8333-333333333333"
const opportunity = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "SYNTHETIC-140",
  is_demo: true,
  status: "active",
  source_office_id: officeId,
  description: "Synthetic description",
  office_contacts: [
    { affiliation_id: affiliationId, is_active: true, is_primary: true },
  ],
} as OpportunityWithSource
const officeOptions: MaOfficeIntakeOffice[] = [
  {
    office_id: officeId,
    firm_id: "44444444-4444-4444-8444-444444444444",
    firm_name: "Synthetic advisory",
    office_name: "Paris",
    office_label: "Synthetic advisory · Paris",
    contacts: [
      {
        affiliation_id: affiliationId,
        contact_id: "55555555-5555-4555-8555-555555555555",
        contact_name: "Synthetic contact",
        contact_email: "contact@example.invalid",
      },
    ],
  },
]

function render(sourceOfficeHasHistory?: boolean, record = opportunity) {
  return renderToStaticMarkup(
    React.createElement(OpportunityForm, {
      opportunity: record,
      sourceOfficeHasHistory,
      officeOptions,
      geographyOptions: [],
      action: async () => ({ success: true, message: "Saved" }),
    }),
  )
}

function officeControl(html: string) {
  return html.match(/<button\b[^>]*\bid="source_office"[^>]*>/)?.[0] ?? ""
}

describe("staff edit form source-history protection", () => {
  it("edits one public description and retains original text as collapsed, non-submitted history", () => {
    const html = render(true, { ...opportunity, teaser_summary: "Public synthetic business", internal_notes: "Private synthetic note" })
    expect(html).toContain("Public business description")
    expect(html).toMatch(/<textarea[^>]*name="teaser_summary"[^>]*>Public synthetic business<\/textarea>/)
    expect(html).not.toMatch(/name="description"/)
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Original source text/)
    expect(html).toContain("Synthetic description")
    expect(html).toContain("Private synthetic note")
    expect(html).toContain('id="public_description_approved"')
    expect(html).not.toContain("Activation never")
  })
  it("locks only source selection when linked history exists and explains why", () => {
    const html = render(true)
    expect(officeControl(html)).toContain(' disabled=""')
    expect(html).toContain("linked interaction history")
    expect(html).toMatch(
      /<button[^>]* disabled=""[^>]*>Add firm context<\/button>/,
    )
    expect(html).toContain(`name="source_office_id" value="${officeId}"`)
    expect(html).toMatch(
      /<input[^>]*name="primary_affiliation_id"[^>]*checked=""[^>]*>/,
    )
    expect(
      html.match(/<textarea[^>]*id="teaser_summary"[^>]*>/)?.[0],
    ).not.toContain(' disabled=""')
    expect(
      html.match(/<button[^>]*id="office_affiliation_[^"]+"[^>]*>/)?.[0],
    ).not.toContain(' disabled=""')
    expect(
      html.match(/<button[^>]*>Add office contact<\/button>/)?.[0],
    ).not.toContain(' disabled=""')
  })

  it("keeps an existing office editable only after history is known to be empty", () => {
    expect(officeControl(render(false))).not.toContain(' disabled=""')
    const unknown = render()
    expect(officeControl(unknown)).toContain(' disabled=""')
    expect(unknown).toContain("interaction history is verified")
  })

  it("lets new opportunities choose a source without a history lookup", () => {
    const html = renderToStaticMarkup(
      React.createElement(OpportunityForm, {
        officeOptions,
        geographyOptions: [],
        action: async () => {},
      }),
    )
    expect(officeControl(html)).not.toBe("")
    expect(officeControl(html)).not.toContain(' disabled=""')
  })

  it("retains historical-record read-only controls even when history is empty", () => {
    expect(
      officeControl(render(false, { ...opportunity, status: "closed" })),
    ).toContain(' disabled=""')
  })
})
