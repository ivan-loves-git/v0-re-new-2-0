import type {
  RepreneurDealFlowOpportunity,
  RepreneurOpportunityExposure,
} from "@/lib/types/opportunity";

export type RepreneurDealDiscoveryOpportunity =
  | RepreneurOpportunityExposure
  | RepreneurDealFlowOpportunity;

export type RepreneurDealDiscoveryFilters = {
  geography: string;
  sector: string;
  revenue: string;
  ebitdaMargin: string;
  employees: string;
};

export const EMPTY_REPRENEUR_DEAL_DISCOVERY_FILTERS: RepreneurDealDiscoveryFilters =
  {
    geography: "",
    sector: "",
    revenue: "",
    ebitdaMargin: "",
    employees: "",
  };

type RepreneurDealMetric = number | null | undefined;

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function hasNumericValue(value: RepreneurDealMetric): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function employeeCount(opportunity: RepreneurDealDiscoveryOpportunity) {
  if (hasNumericValue(opportunity.headcount)) return opportunity.headcount;

  const rangeValues =
    opportunity.headcount_range?.match(/\d+/g)?.map(Number) ?? [];
  if (rangeValues.length === 1) return rangeValues[0];
  if (rangeValues.length >= 2)
    return Math.round((rangeValues[0] + rangeValues[1]) / 2);
  return null;
}

function isWithinBucket(
  value: RepreneurDealMetric,
  bucket: string,
  thresholds: readonly number[],
) {
  if (!hasNumericValue(value)) return bucket === "unknown";

  const [first, second, third] = thresholds;
  switch (bucket) {
    case "under-first":
      return value < first;
    case "first-to-second":
      return value >= first && value <= second;
    case "second-to-third":
      return value > second && value <= third;
    case "over-third":
      return value > third;
    default:
      return true;
  }
}

export function getEbitdaMarginPercentage(
  opportunity: RepreneurDealDiscoveryOpportunity,
) {
  if (
    !hasNumericValue(opportunity.revenue_meur) ||
    opportunity.revenue_meur <= 0
  )
    return null;
  if (!hasNumericValue(opportunity.ebitda_keur)) return null;

  return (opportunity.ebitda_keur / (opportunity.revenue_meur * 1000)) * 100;
}

export function isStaffRecommended(opportunity: RepreneurDealDiscoveryOpportunity) {
  if ("is_staff_recommended" in opportunity) return opportunity.is_staff_recommended;
  return true;
}

/**
 * R3-1 owns the scoring and hard-filter decision. R3-2 only presents the
 * existing not-fit signal in a separate, neutral section and never reorders
 * the source list within a section.
 */
export function isOutsideCurrentCriteria(
  opportunity: RepreneurDealDiscoveryOpportunity,
) {
  return "is_outside_current_criteria" in opportunity && opportunity.is_outside_current_criteria;
}

export function filterRepreneurDeals(
  opportunities: RepreneurDealDiscoveryOpportunity[],
  search: string,
  filters: RepreneurDealDiscoveryFilters,
) {
  const normalizedSearch = normalizeText(search);

  return opportunities.filter((opportunity) => {
    const margin = getEbitdaMarginPercentage(opportunity);
    const staff = employeeCount(opportunity);
    const matchesSearch =
      !normalizedSearch ||
      [
        opportunity.public_title,
        opportunity.reference,
        opportunity.location,
        opportunity.sector,
        opportunity.activity,
        opportunity.revenue_meur?.toString(),
        margin?.toFixed(1),
        margin === null ? null : `${margin}%`,
        staff?.toString(),
        opportunity.headcount_range,
      ].some((value) => normalizeText(value).includes(normalizedSearch));

    const matchesGeography =
      !filters.geography ||
      normalizeText(opportunity.location) === filters.geography;
    const matchesSector =
      !filters.sector ||
      normalizeText(opportunity.sector) === filters.sector ||
      normalizeText(opportunity.activity) === filters.sector;
    const matchesRevenue =
      !filters.revenue ||
      isWithinBucket(opportunity.revenue_meur, filters.revenue, [1, 3, 5]);
    const matchesMargin =
      !filters.ebitdaMargin ||
      isWithinBucket(margin, filters.ebitdaMargin, [10, 20, 30]);
    const matchesEmployees =
      !filters.employees ||
      isWithinBucket(staff, filters.employees, [10, 50, 250]);

    return (
      matchesSearch &&
      matchesGeography &&
      matchesSector &&
      matchesRevenue &&
      matchesMargin &&
      matchesEmployees
    );
  });
}

export function partitionRepreneurDeals(
  opportunities: RepreneurDealDiscoveryOpportunity[],
) {
  const staffRecommended: RepreneurDealDiscoveryOpportunity[] = [];
  const remaining: RepreneurDealDiscoveryOpportunity[] = [];
  const outsideCurrentCriteria: RepreneurDealDiscoveryOpportunity[] = [];
  const declined: RepreneurDealDiscoveryOpportunity[] = [];

  for (const opportunity of opportunities) {
    if (opportunity.match_status === "declined") {
      declined.push(opportunity);
    } else if (isStaffRecommended(opportunity)) {
      staffRecommended.push(opportunity);
    } else if (isOutsideCurrentCriteria(opportunity)) {
      outsideCurrentCriteria.push(opportunity);
    } else {
      remaining.push(opportunity);
    }
  }

  return { staffRecommended, remaining, outsideCurrentCriteria, declined };
}
