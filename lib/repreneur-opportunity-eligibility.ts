import "server-only"

type RepreneurOpportunityEligibilityProjection = {
  is_demo?: boolean | null
}

type RepreneurNamespaceProjection = {
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

/**
 * Portal authority is namespace equality, not a blanket DEMO veto. This keeps
 * REAL and DEMO data isolated while preserving a controlled DEMO-to-DEMO UAT
 * path. Missing classifications fail closed.
 */
export function isOpportunityInRepreneurNamespace(
  opportunity: RepreneurOpportunityEligibilityProjection | null | undefined,
  repreneur: RepreneurNamespaceProjection | null | undefined,
) {
  return typeof opportunity?.is_demo === "boolean"
    && typeof repreneur?.is_demo === "boolean"
    && opportunity.is_demo === repreneur.is_demo
}
