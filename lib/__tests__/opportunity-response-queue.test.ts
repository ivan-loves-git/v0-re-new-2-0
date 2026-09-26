import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { isPendingOpportunityResponse } from "@/lib/opportunity-response-queue"
import { OpportunityResponseReviewTable } from "@/components/opportunities/opportunity-response-review-table"
import type { OpportunityMatchResponse } from "@/lib/types/opportunity"

describe("opportunity response queue", () => {
  it("retains a withdrawn row without counting it as pending or manufacturing a review", () => {
    expect(isPendingOpportunityResponse({ status: "withdrawn", reviewed_at: null })).toBe(false)
    expect(isPendingOpportunityResponse({ status: "interested", reviewed_at: null })).toBe(true)
    expect(isPendingOpportunityResponse({ status: "declined", reviewed_at: null })).toBe(true)
    expect(isPendingOpportunityResponse({ status: "interested", reviewed_at: "2026-09-27T10:00:00Z" })).toBe(false)
  })

  it("shows withdrawn history without New response, validation, or Mark reviewed controls", () => {
    const withdrawn = {
      id: "97000000-0000-4000-8000-000000000081",
      opportunity_id: "97000000-0000-4000-8000-000000000071",
      repreneur_id: "97000000-0000-4000-8000-000000000004",
      status: "withdrawn", reviewed_at: null,
      updated_at: "2026-09-27T10:00:00Z",
      platform_recommendation: "not_evaluated",
      human_recommendation: "not_evaluated",
      interest_withdrawal: { interest_expressed_at: "2026-09-27T09:00:00Z",
        reason: "Synthetic withdrawal", withdrawn_at: "2026-09-27T10:00:00Z",
        actor: "synthetic-owner", origin: "owner" },
    } as OpportunityMatchResponse
    const html = renderToStaticMarkup(createElement(OpportunityResponseReviewTable,
      { responses: [withdrawn] }))
    expect(html).toContain("Withdrawn")
    expect(html).toContain("Synthetic withdrawal")
    expect(html).toContain("All responses have been reviewed.")
    expect(html).toContain("Historical withdrawal; no validation pending")
    expect(html).not.toContain("New response")
    expect(html).not.toContain("Mark reviewed")
    expect(html).not.toContain("Validate pursuit")
  })
})
