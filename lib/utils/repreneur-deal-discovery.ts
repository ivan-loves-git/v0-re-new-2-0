import type {
  RepreneurDealFlowOpportunity,
  RepreneurOpportunityExposure,
} from "@/lib/types/opportunity"
import { isRecommendationResponseOpen } from "@/lib/opportunity-recommendation-window"

export type RepreneurDealDiscoveryOpportunity =
  | RepreneurOpportunityExposure
  | RepreneurDealFlowOpportunity

/**
 * Deal Flow taxonomy filters allow multiple values within one taxonomy. Numeric controls
 * are inclusive bounds; a missing metric never satisfies an active criterion.
 */
export type RepreneurDealDiscoveryFilters = {
  geography: string[]
  sector: string[]
  revenueMin: string
  revenueMax: string
  ebitdaMarginMin: string
  employeesMin: string
  employeesMax: string
}

export const EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS: RepreneurDealDiscoveryFilters = {
  geography: [],
  sector: [],
  revenueMin: "",
  revenueMax: "",
  ebitdaMarginMin: "",
  employeesMin: "",
  employeesMax: "",
}

type RepreneurDealMetric = number | null | undefined

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function hasNumericValue(value: RepreneurDealMetric): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function optionalBound(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

function employeeCount(opportunity: RepreneurDealDiscoveryOpportunity) {
  if (hasNumericValue(opportunity.headcount)) return opportunity.headcount

  const rangeValues = opportunity.headcount_range?.match(/\d+/g)?.map(Number) ?? []
  if (rangeValues.length === 1) return rangeValues[0]
  if (rangeValues.length >= 2) return Math.round((rangeValues[0] + rangeValues[1]) / 2)
  return null
}

function isWithinInclusiveRange(value: RepreneurDealMetric, minimum: string, maximum: string) {
  const lowerBound = optionalBound(minimum)
  const upperBound = optionalBound(maximum)
  if (lowerBound === null && upperBound === null) return true
  if (!hasNumericValue(value)) return false
  return (lowerBound === null || value >= lowerBound)
    && (upperBound === null || value <= upperBound)
}

export function getEbitdaMarginPercentage(opportunity: RepreneurDealDiscoveryOpportunity) {
  if (!hasNumericValue(opportunity.revenue_meur) || opportunity.revenue_meur <= 0) return null
  if (!hasNumericValue(opportunity.ebitda_keur)) return null

  return (opportunity.ebitda_keur / (opportunity.revenue_meur * 1000)) * 100
}

export function isStaffRecommended(opportunity: RepreneurDealDiscoveryOpportunity) {
  if ("is_staff_recommended" in opportunity) {
    return opportunity.is_staff_recommended
      && Boolean(opportunity.interest_expressed_at)
        ? true
        : opportunity.is_staff_recommended && isRecommendationResponseOpen(opportunity.recommendation_expires_at)
  }
  return true
}

/**
 * R3-1 owns the scoring and hard-filter decision. R3-2 only presents the
 * existing not-fit signal in a separate, neutral section and never reorders
 * the source list within a section.
 */
export function isOutsideCurrentCriteria(opportunity: RepreneurDealDiscoveryOpportunity) {
  return "is_outside_current_criteria" in opportunity && opportunity.is_outside_current_criteria
}

export function filterRepreneurDeals(
  opportunities: RepreneurDealDiscoveryOpportunity[],
  search: string,
  filters: RepreneurDealDiscoveryFilters,
) {
  const normalizedSearch = normalizeText(search)

  return opportunities.filter((opportunity) => {
    const margin = getEbitdaMarginPercentage(opportunity)
    const staff = employeeCount(opportunity)
    const matchesSearch = !normalizedSearch || [
      opportunity.public_title,
      // The teaser is the already-sanitised portal projection. Never search
      // or fall back to the staff-only description.
      opportunity.teaser_summary,
      opportunity.reference,
      opportunity.location,
      opportunity.sector,
      opportunity.canonical_sector,
      opportunity.activity,
      opportunity.revenue_meur?.toString(),
      margin?.toFixed(1),
      margin === null ? null : `${margin}%`,
      staff?.toString(),
      opportunity.headcount_range,
    ].some((value) => normalizeText(value).includes(normalizedSearch))

    const matchesGeography = filters.geography.length === 0
      || (opportunity.geography_filter_nodes !== undefined
        ? opportunity.geography_filter_nodes.some((node) =>
          filters.geography.includes(node.id)
          || node.equivalentNodeIds?.some((id) => filters.geography.includes(id)))
        : (opportunity.geography_node_id !== null
          && opportunity.geography_node_id !== undefined
          && filters.geography.includes(opportunity.geography_node_id)))
    const matchesSector = filters.sector.length === 0
      || (opportunity.canonical_sector !== null
        && opportunity.canonical_sector !== undefined
        && filters.sector.includes(opportunity.canonical_sector))
    const matchesRevenue = isWithinInclusiveRange(
      opportunity.revenue_meur,
      filters.revenueMin,
      filters.revenueMax,
    )
    const matchesMargin = isWithinInclusiveRange(margin, filters.ebitdaMarginMin, "")
    const matchesEmployees = isWithinInclusiveRange(
      staff,
      filters.employeesMin,
      filters.employeesMax,
    )

    return matchesSearch
      && matchesGeography
      && matchesSector
      && matchesRevenue
      && matchesMargin
      && matchesEmployees
  })
}

export function partitionRepreneurDeals(opportunities: RepreneurDealDiscoveryOpportunity[]) {
  const staffRecommended: RepreneurDealDiscoveryOpportunity[] = []
  const remaining: RepreneurDealDiscoveryOpportunity[] = []
  const outsideCurrentCriteria: RepreneurDealDiscoveryOpportunity[] = []
  const declined: RepreneurDealDiscoveryOpportunity[] = []

  for (const opportunity of opportunities) {
    if (opportunity.match_status === "declined") {
      declined.push(opportunity)
    } else if (isStaffRecommended(opportunity)) {
      staffRecommended.push(opportunity)
    } else if (isOutsideCurrentCriteria(opportunity)) {
      outsideCurrentCriteria.push(opportunity)
    } else {
      remaining.push(opportunity)
    }
  }

  return { staffRecommended, remaining, outsideCurrentCriteria, declined }
}
