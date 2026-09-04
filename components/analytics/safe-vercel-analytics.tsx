"use client"

import { Analytics, type AnalyticsProps } from "@vercel/analytics/next"
import { PASSWORD_RESET_BROWSER_PATH } from "@/lib/password-reset-token"

type AnalyticsEvent = Parameters<NonNullable<AnalyticsProps["beforeSend"]>>[0]

export function filterSensitiveAnalyticsPage(
  event: AnalyticsEvent,
): AnalyticsEvent | null {
  try {
    const pathname = new URL(
      event.url,
      "https://app.re-new.team",
    ).pathname.replace(/\/+$/, "")
    if (pathname === PASSWORD_RESET_BROWSER_PATH) return null
  } catch {
    return null
  }

  return event
}

export function SafeVercelAnalytics() {
  return <Analytics beforeSend={filterSensitiveAnalyticsPage} />
}
