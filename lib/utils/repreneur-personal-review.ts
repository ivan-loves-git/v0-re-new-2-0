import type { RepreneurPersonalReview } from "@/lib/types/opportunity"

/** A stable presentation partition, never a relevance score or business-state change. */
export function partitionPersonalReviews<T extends { personal_review?: RepreneurPersonalReview | null }>(items: T[]) {
  const available = items.every((item) => item.personal_review != null)
  return {
    available,
    unreviewed: available ? items.filter((item) => !item.personal_review?.reviewed) : [],
    reviewed: available ? items.filter((item) => item.personal_review?.reviewed) : [],
  }
}
