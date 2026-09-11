export const RECOMMENDATION_RESPONSE_WINDOW_MS = 72 * 60 * 60 * 1000

/**
 * Historical matches have no publication clock. They are deliberately
 * grandfathered: never infer a deadline from a mutable legacy timestamp.
 */
export function isRecommendationResponseOpen(
  expiresAt: string | null | undefined,
  now: string = new Date().toISOString(),
) {
  return !expiresAt || Date.parse(expiresAt) > Date.parse(now)
}

export function isRecommendationResponseExpired(
  expiresAt: string | null | undefined,
  now?: string,
) {
  return Boolean(expiresAt) && !isRecommendationResponseOpen(expiresAt, now)
}

export function recommendationExpiryAt(publishedAt: string) {
  return new Date(Date.parse(publishedAt) + RECOMMENDATION_RESPONSE_WINDOW_MS).toISOString()
}
