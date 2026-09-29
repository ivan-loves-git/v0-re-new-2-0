import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/actions/opportunity-matches", () => ({ rejectOpportunityInterest: vi.fn() }))

import { StaffInterestRejectionControl } from "@/components/opportunities/staff-interest-rejection-control"

function renderRecordedDecisionIn(timeZone: string) {
  const previousTimeZone = process.env.TZ
  try {
    process.env.TZ = timeZone
    return renderToStaticMarkup(createElement(StaffInterestRejectionControl, {
      matchId: "match-1",
      opportunityId: "opportunity-1",
      interestAt: "2026-09-22T11:00:00.000Z",
      updatedAt: "2026-09-22T11:00:00.000Z",
      rejection: {
        reason: "Internal staff-only reason",
        decided_at: "2026-09-22T12:33:00.000Z",
        decided_by: "staff@example.test",
        delivery_status: "suppressed",
      },
    }))
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimeZone
  }
}

describe("staff exact-interest rejection hydration", () => {
  it("renders the same recorded-decision text on a UTC server and a Paris browser", () => {
    const serverHtml = renderRecordedDecisionIn("UTC")
    const browserHtml = renderRecordedDecisionIn("Europe/Paris")

    expect(serverHtml).toContain("Recorded")
    expect(serverHtml).toContain("Recorded 22 sept. 2026, 14:33")
    expect(serverHtml).toBe(browserHtml)
  })
})
