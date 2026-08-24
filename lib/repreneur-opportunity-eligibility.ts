import "server-only"

type RepreneurOpportunityEligibilityProjection = {
  is_demo?: boolean | null
}

/**
 * One fail-closed eligibility rule for every repreneur-facing opportunity
 * projection. Titles, references, and other display text are deliberately not
 * classification inputs.
 */
export function isRepreneurEligibleOpportunity<
  T extends RepreneurOpportunityEligibilityProjection,
>(
  opportunity: T | null | undefined,
) {
  return opportunity?.is_demo === false
}
