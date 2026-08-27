import type { Opportunity } from "@/lib/types/opportunity"

export type BroadDiscoveryPublicationState = {
  mode: "visible" | "hidden"
  namespace: "REAL" | "DEMO"
  missingFields: string[]
}

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
  return {
    mode: opportunity.status === "active" ? "visible" : "hidden",
    namespace: opportunity.is_demo ? "DEMO" : "REAL",
    missingFields: missingBroadDiscoveryReaderFields(opportunity),
  }
}
