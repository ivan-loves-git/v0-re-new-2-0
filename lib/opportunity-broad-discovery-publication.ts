import type { Opportunity, OpportunityVisibility } from "@/lib/types/opportunity"

export type BroadDiscoveryPublicationState =
  | { mode: "publish" }
  | { mode: "remove" }
  | { mode: "incomplete"; missingFields: string[] }
  | { mode: "unavailable" }

const readerFacingFields = [
  ["public_title", "title"],
  ["teaser_summary", "teaser"],
  ["sector", "sector"],
  ["location", "location"],
] as const

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

export function missingBroadDiscoveryReaderFields(
  opportunity: Pick<
    Opportunity,
    "public_title" | "teaser_summary" | "sector" | "location"
  >,
) {
  return readerFacingFields
    .filter(([field]) => !hasText(opportunity[field]))
    .map(([, label]) => label)
}

export function broadDiscoveryPublicationState(
  opportunity: Pick<
    Opportunity,
    | "status"
    | "is_demo"
    | "repreneur_exposure"
    | "public_title"
    | "teaser_summary"
    | "sector"
    | "location"
  >,
): BroadDiscoveryPublicationState {
  if (opportunity.is_demo || opportunity.status !== "active") {
    return { mode: "unavailable" }
  }

  if (opportunity.repreneur_exposure === "anonymized") {
    return { mode: "remove" }
  }

  if (opportunity.repreneur_exposure !== "staff_only") {
    return { mode: "unavailable" }
  }

  const missingFields = missingBroadDiscoveryReaderFields(opportunity)
  return missingFields.length > 0
    ? { mode: "incomplete", missingFields }
    : { mode: "publish" }
}

export function isAllowedBroadDiscoveryVisibility(
  visibility: OpportunityVisibility,
) {
  return visibility === "staff_only" || visibility === "anonymized"
}
