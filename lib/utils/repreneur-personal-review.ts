import type { RepreneurPersonalReview } from "@/lib/types/opportunity"

/** A stable presentation partition, never a relevance score or business-state change. */
export function partitionPersonalReviews<T extends { personal_review?: RepreneurPersonalReview | null }>(items: T[]) {
  return {
    unreviewed: items.filter((item) => !item.personal_review?.reviewed),
    reviewed: items.filter((item) => item.personal_review?.reviewed),
  }
}
