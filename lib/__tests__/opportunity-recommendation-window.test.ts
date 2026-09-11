import { describe, expect, it } from "vitest"
import {
  RECOMMENDATION_RESPONSE_WINDOW_MS,
  isRecommendationResponseOpen,
  isRecommendationResponseExpired,
  recommendationExpiryAt,
} from "@/lib/opportunity-recommendation-window"

describe("opportunity recommendation response window", () => {
  const publishedAt = "2026-09-11T10:00:00.000Z"

  it("opens exactly 72 hours from an explicit publication", () => {
    expect(recommendationExpiryAt(publishedAt)).toBe("2026-09-14T10:00:00.000Z")
    expect(RECOMMENDATION_RESPONSE_WINDOW_MS).toBe(72 * 60 * 60 * 1000)
  })

  it("keeps historical unclocked matches outside the new expiry rule", () => {
    expect(isRecommendationResponseOpen(null, "2026-12-01T00:00:00.000Z")).toBe(true)
  })

  it("closes a published recommendation at its exact deadline", () => {
    const expiresAt = recommendationExpiryAt(publishedAt)
    expect(isRecommendationResponseOpen(expiresAt, "2026-09-14T09:59:59.999Z")).toBe(true)
    expect(isRecommendationResponseOpen(expiresAt, expiresAt)).toBe(false)
  })

  it("identifies an explicit expiry without treating historical null as expired", () => {
    expect(isRecommendationResponseExpired(null, "2026-12-01T00:00:00.000Z")).toBe(false)
    expect(isRecommendationResponseExpired("2026-09-14T10:00:00.000Z", "2026-09-14T10:00:00.000Z")).toBe(true)
  })
})
