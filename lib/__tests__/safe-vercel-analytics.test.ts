import { describe, expect, it } from "vitest"
import { filterSensitiveAnalyticsPage } from "@/components/analytics/safe-vercel-analytics"

describe("Vercel Analytics password-reset privacy", () => {
  it.each([
    "https://app.re-new.team/auth/reset-password",
    "https://app.re-new.team/auth/reset-password?intent=portal",
    "https://app.re-new.team/auth/reset-password#token=secret",
    "/auth/reset-password/",
  ])("drops all analytics events for %s", (url) => {
    expect(filterSensitiveAnalyticsPage({ type: "pageview", url })).toBeNull()
  })

  it("keeps ordinary page views unchanged", () => {
    const event = {
      type: "pageview" as const,
      url: "https://app.re-new.team/portal/deals",
    }
    expect(filterSensitiveAnalyticsPage(event)).toBe(event)
  })

  it("fails closed for an unparseable analytics URL", () => {
    expect(
      filterSensitiveAnalyticsPage({ type: "event", url: "http://[" }),
    ).toBeNull()
  })
})
