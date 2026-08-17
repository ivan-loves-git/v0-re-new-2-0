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
    const now = new Date("2026-05-15T12:00:00.000Z")
    expect(opportunityDaysOpen("2026-01-01", now, "day")).toBe(134)
    expect(opportunityDaysOpen("2026-01-01", now, null)).toBe(134)
  })

  it("keeps the 89/90-day boundary stable across daylight-saving changes", () => {
    const now = new Date("2026-04-02T12:00:00.000Z")
    expect(opportunityDaysOpen("2026-01-03", now, "day")).toBe(89)
    expect(opportunityDaysOpen("2026-01-02", now, "day")).toBe(90)
  })
})
