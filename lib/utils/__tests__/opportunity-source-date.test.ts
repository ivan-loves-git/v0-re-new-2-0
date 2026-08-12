import { describe, expect, it } from "vitest"
import {
  dayLevelOpportunityDate,
  formatOpportunitySourceDate,
} from "@/lib/utils/opportunity-source-date"
import {
  isCandidateStaleOpportunity,
  opportunityDaysOpen,
} from "@/lib/opportunity-freshness-policy"

describe("opportunity source-date precision", () => {
  it("renders a month-only CRM date without inventing its first day", () => {
    expect(formatOpportunitySourceDate("2026-01-01", "month")).toBe(
      "janvier 2026",
    )
    expect(dayLevelOpportunityDate("2026-01-01", "month")).toBeNull()
  })

  it("keeps month-only values out of day-level stale rules", () => {
    const now = new Date("2026-05-15T12:00:00")
    expect(opportunityDaysOpen("2026-01-01", now, "month")).toBeNull()
    expect(
      isCandidateStaleOpportunity(
        {
          id: "month-only",
          status: "active",
          dateAdded: "2026-01-01",
          dateAddedPrecision: "month",
        },
        new Set(),
        now,
      ),
    ).toBe(false)
  })

  it("retains day-level behavior for an exact or legacy source date", () => {
    const now = new Date("2026-05-15T12:00:00")
    expect(opportunityDaysOpen("2026-01-01", now, "day")).toBe(133)
    expect(opportunityDaysOpen("2026-01-01", now, null)).toBe(133)
  })
})
