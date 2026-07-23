import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  DECLINE_REASON_OPTIONS,
  isDeclineReasonCategory,
} from "@/lib/types/repreneur"
import {
  isOpportunityDeclineReasonCategory,
  OPPORTUNITY_DECLINE_REASON_OPTIONS,
} from "@/lib/types/opportunity"

const platformRoot = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("Engagement decline reasons", () => {
  it("keeps commercial-offer and deal-proposal taxonomies separate", () => {
    expect(DECLINE_REASON_OPTIONS).toEqual([
      { value: "chose_competitor", label: "Chose a competitor" },
      { value: "doing_independently", label: "Decided to do it independently" },
      { value: "pricing_too_high", label: "Pricing too high" },
      { value: "timing_not_right", label: "Timing not right" },
      { value: "changed_plans", label: "Changed plans (no longer pursuing acquisition)" },
      { value: "insufficient_funding", label: "Insufficient funding" },
      { value: "other", label: "Other" },
    ])

    for (const option of DECLINE_REASON_OPTIONS) {
      expect(isDeclineReasonCategory(option.value)).toBe(true)
    }
    expect(isDeclineReasonCategory("geography")).toBe(false)
    expect(isDeclineReasonCategory("")).toBe(false)
    expect(isDeclineReasonCategory(null)).toBe(false)

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

  it("captures a commercial reason and optional context before the Engagement offer decline", () => {
    const engagementSource = source("components/offers/repreneur-offers-list.tsx")

    expect(engagementSource).toContain("DECLINE_REASON_OPTIONS")
    expect(engagementSource).toContain("DeclineReasonCategory")
    expect(engagementSource).not.toContain("OPPORTUNITY_DECLINE_REASON_OPTIONS")
    expect(engagementSource).toContain("if (!decliningOffer || !declineReasonCategory) return")
    expect(engagementSource).toContain("declineReasonCategory,")
    expect(engagementSource).toContain("declineReasonText,")
    expect(engagementSource).toContain("Details (optional)")
  })

  it("validates supplied commercial values while preserving legacy status transitions and analytics labels", () => {
    const actionSource = source("lib/actions/offers.ts")
    const analyticsSource = source("components/analytics/decline-reasons.tsx")

    expect(actionSource).toContain("isDeclineReasonCategory")
    expect(actionSource).not.toContain("isOpportunityDeclineReasonCategory")
    expect(actionSource).toContain("declineReasonCategory !== undefined")
    expect(actionSource).not.toContain("declineReasonCategory &&")
    expect(actionSource).toContain("decline_reason_category: declineReasonCategory || null")
    expect(actionSource).toContain("decline_reason_text: normalizedDeclineReasonText")
    expect(analyticsSource).toContain("DECLINE_REASON_OPTIONS")
    expect(analyticsSource).toContain("OPPORTUNITY_DECLINE_REASON_OPTIONS")
  })
})
