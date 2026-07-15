import type { RepreneurDealFlowOpportunity } from "@/lib/types/opportunity"

export type RepreneurDealFlowSortCandidate = RepreneurDealFlowOpportunity & {
  relevance_score: number
}

export const REPRENEUR_DEAL_SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "deal_size", label: "Deal size" },
  { value: "date_added", label: "Date added" },
] as const

export type RepreneurDealSort = (typeof REPRENEUR_DEAL_SORT_OPTIONS)[number]["value"]

const REPRENEUR_DEAL_SORT_VALUES = new Set<RepreneurDealSort>(
  REPRENEUR_DEAL_SORT_OPTIONS.map((option) => option.value),
)

export function parseRepreneurDealSort(value: string | null | undefined): RepreneurDealSort {
  return REPRENEUR_DEAL_SORT_VALUES.has(value as RepreneurDealSort)
    ? (value as RepreneurDealSort)
    : "relevance"
}

function dateValue(opportunity: RepreneurDealFlowSortCandidate) {
  const value = opportunity.date_added ?? opportunity.updated_at
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareByRelevance(
  left: RepreneurDealFlowSortCandidate,
  right: RepreneurDealFlowSortCandidate,
) {
  return right.relevance_score - left.relevance_score || dateValue(right) - dateValue(left)
}

export function sortRepreneurDealFlow(
  opportunities: RepreneurDealFlowSortCandidate[],
  sort: RepreneurDealSort,
) {
  return [...opportunities].sort((left, right) => {
    if (sort === "deal_size") {
      const leftSize = left.revenue_meur ?? Number.NEGATIVE_INFINITY
      const rightSize = right.revenue_meur ?? Number.NEGATIVE_INFINITY
      return rightSize - leftSize || compareByRelevance(left, right)
    }

    if (sort === "date_added") {
      return dateValue(right) - dateValue(left) || compareByRelevance(left, right)
    }

    return compareByRelevance(left, right)
  })
}
