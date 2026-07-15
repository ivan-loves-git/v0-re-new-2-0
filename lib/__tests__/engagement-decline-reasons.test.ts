import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  isOpportunityDeclineReasonCategory,
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
} from "@/lib/types/opportunity"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("Engagement decline reasons", () => {
  it("keeps one canonical rationale taxonomy", () => {
    expect(OPPORTUNITY_DECLINE_REASON_OPTIONS).toEqual([
      { value: "geography", label: "Geography" },
      { value: "sector", label: "Industry / sector" },
      { value: "size_metrics", label: "Size / metrics" },
      { value: "business_model", label: "Business model" },
      { value: "other", label: "Other" },
    ])

    for (const option of OPPORTUNITY_DECLINE_REASON_OPTIONS) {
      expect(isOpportunityDeclineReasonCategory(option.value)).toBe(true)
    }
    expect(isOpportunityDeclineReasonCategory("pricing_too_high")).toBe(false)
    expect(isOpportunityDeclineReasonCategory(null)).toBe(false)
  })

  it("captures the canonical reason before the Engagement offer decline", () => {
    const engagementSource = source("components/offers/repreneur-offers-list.tsx")

    expect(engagementSource).toContain("OPPORTUNITY_DECLINE_REASON_OPTIONS")
    expect(engagementSource).toContain("if (!decliningOffer || !declineReasonCategory) return")
    expect(engagementSource).toContain("declineReasonCategory,")
    expect(engagementSource).toContain("declineReasonText,")
  })

  it("uses the existing repreneur analytics fields instead of adding offer fields", () => {
    const actionSource = source("lib/actions/offers.ts")
    const analyticsSource = source("components/analytics/decline-reasons.tsx")

    expect(actionSource).toContain("isOpportunityDeclineReasonCategory")
    expect(actionSource).toContain("decline_reason_category: declineReasonCategory || null")
    expect(actionSource).toContain("decline_reason_text: normalizedDeclineReasonText")
    expect(analyticsSource).toContain("OPPORTUNITY_DECLINE_REASON_OPTIONS")
  })
})
