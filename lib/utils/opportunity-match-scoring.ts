import type { OpportunityMatchRecommendation } from "@/lib/types/opportunity"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  canonicalTargetThesisValues,
  targetThesisMatchTerms,
} from "@/lib/repreneur-target-thesis"
import { sectorCompatibilityValues } from "@/lib/utils/opportunity-sector"

/**
 * Temporary commercial calibration approved by Ivan for the first Matching v2
 * release. Bertrand's later calibration should change only this object and the
 * version label, followed by the representative matching tests.
 */
export const MATCHING_V2_CONFIG = {
  version: "provisional-2026-08-23",
  weights: {
    sector: 30,
    geography: 25,
    revenue: 25,
    ebitdaMargin: 12,
    headcount: 8,
  },
  tolerances: {
    rangeRelativeOutside: 0.2,
    ebitdaMarginPercentagePointsBelow: 2,
  },
  fallbacks: {
    ebitdaMarginMinimumPct: 0,
  },
  evidence: {
    reviewMaximumScore: 70,
  },
  placementCaps: {
    sectorMismatch: 44,
    sectorReview: 70,
    geographyMismatch: 60,
    geographyReview: 70,
    revenueMismatch: 44,
    ebitdaMarginMismatch: 44,
    headcountMismatch: 64,
  },
} as const

type ScoringRepreneur = {
  // WHO, WHEN and scoring flags remain qualification inputs only. They are
  // accepted here for backwards-compatible callers but never read below.
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  q12_geo_zones?: string | string[] | null
  q13_target_sectors_v2?: string | string[] | null
  sector_preferences?: string | string[] | null
  target_location?: string | string[] | null
  target_revenue_min_meur?: number | string | null
  target_revenue_max_meur?: number | string | null
  target_ebitda_margin_min_pct?: number | string | null
  target_staff_size_min?: number | string | null
  target_staff_size_max?: number | string | null
  /** One self-to-root stable-key path per canonical target node. */
  target_geography_paths_stable_keys?: string[][] | null
}

type ScoringOpportunity = {
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | string | null
  ebitda_keur?: number | string | null
  headcount?: number | string | null
  geography_node_id?: string | null
  /** Canonical node followed by its France-tree ancestors. */
  geography_path_stable_keys?: string[] | null
}

export type OpportunityMatchScoreResult = {
  score: number
  recommendation: OpportunityMatchRecommendation
  reasons: string[]
}

type CriterionOutcome = "match" | "borderline" | "mismatch" | "review"

type CriterionResult = {
  points: number
  knownWeight: number
  outcome: CriterionOutcome
  reason: string
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeText(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() ?? ""
}

function toTextList(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function normalizeList(...values: Array<string | string[] | null | undefined>) {
  return values.flatMap(toTextList).map(normalizeText).filter(Boolean)
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function hasTextMatch(sourceValues: string[], targetValues: string[]) {
  if (sourceValues.length === 0 || targetValues.length === 0) return null
  return sourceValues.some((source) =>
    targetValues.some((target) => source.includes(target) || target.includes(source)),
  )
}

function preferredList(
  canonical: string | string[] | null | undefined,
  legacy: string | string[] | null | undefined,
) {
  const canonicalValues = normalizeList(canonical)
  return canonicalValues.length > 0 ? canonicalValues : normalizeList(legacy)
}

function recommendationFromScore(score: number): OpportunityMatchRecommendation {
  if (score >= 80) return "strong_fit"
  if (score >= 65) return "possible_fit"
  if (score >= 45) return "weak_fit"
  return "not_fit"
}

function rangeCriterion(
  value: number | null,
  minimum: number | null,
  maximum: number | null,
  weight: number,
  label: string,
): CriterionResult {
  if (minimum !== null && maximum !== null && minimum > maximum) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: `${label} needs review because the target range is invalid.`,
    }
  }

  if (value === null || (minimum === null && maximum === null)) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: `${label} needs review because the target or opportunity value is missing.`,
    }
  }

  const below = minimum !== null && value < minimum
  const above = maximum !== null && value > maximum
  if (!below && !above) {
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: `${label} is within the target range.`,
    }
  }

  const boundary = below ? minimum! : maximum!
  const relativeOutside = boundary > 0
    ? Math.abs(value - boundary) / boundary
    : Number.POSITIVE_INFINITY

  if (relativeOutside <= MATCHING_V2_CONFIG.tolerances.rangeRelativeOutside) {
    return {
      points: weight / 2,
      knownWeight: weight,
      outcome: "borderline",
      reason: `${label} is close to the target range and needs staff judgement.`,
    }
  }

  return {
    points: 0,
    knownWeight: weight,
    outcome: "mismatch",
    reason: `${label} is outside the target range.`,
  }
}

function ebitdaMarginCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const weight = MATCHING_V2_CONFIG.weights.ebitdaMargin
  const configuredMinimumMargin = toNumber(repreneur.target_ebitda_margin_min_pct)
  const minimumMargin = configuredMinimumMargin ??
    MATCHING_V2_CONFIG.fallbacks.ebitdaMarginMinimumPct
  const revenueMeur = toNumber(opportunity.revenue_meur)
  const ebitdaKeur = toNumber(opportunity.ebitda_keur)

  if (
    revenueMeur === null ||
    ebitdaKeur === null ||
    revenueMeur <= 0
  ) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: "EBITDA margin needs review because opportunity revenue or EBITDA is missing.",
    }
  }

  const marginPercent = (ebitdaKeur / (revenueMeur * 1_000)) * 100
  if (marginPercent >= minimumMargin) {
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: configuredMinimumMargin === null
        ? "EBITDA margin meets the provisional 0% fallback because no buyer minimum is recorded."
        : "EBITDA margin meets the minimum target.",
    }
  }

  if (
    minimumMargin - marginPercent <=
    MATCHING_V2_CONFIG.tolerances.ebitdaMarginPercentagePointsBelow
  ) {
    return {
      points: weight / 2,
      knownWeight: weight,
      outcome: "borderline",
      reason: "EBITDA margin is close to the minimum target and needs staff judgement.",
    }
  }

  return {
    points: 0,
    knownWeight: weight,
    outcome: "mismatch",
    reason: "EBITDA margin is below the minimum target.",
  }
}

function canonicalGeographyCriterion(
  targetPaths: string[][],
  opportunityPath: string[],
): CriterionResult {
  const weight = MATCHING_V2_CONFIG.weights.geography

  if (targetPaths.length === 0 || opportunityPath.length === 0) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: "Geography needs review because one side has not been mapped to the France hierarchy.",
    }
  }

  const targetNodeKeys = targetPaths.map((path) => path[0]).filter(Boolean)
  if (targetNodeKeys.some((targetKey) => opportunityPath.includes(targetKey))) {
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: "Geography matches the canonical France hierarchy.",
    }
  }

  const opportunityNodeKey = opportunityPath[0]
  if (targetPaths.some((targetPath) => targetPath.includes(opportunityNodeKey))) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: "Geography needs review because the opportunity is broader than the target area.",
    }
  }

  return {
    points: 0,
    knownWeight: weight,
    outcome: "mismatch",
    reason: "Geography does not match the canonical France hierarchy.",
  }
}

function legacyGeographyCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const weight = MATCHING_V2_CONFIG.weights.geography
  const selectedValues = preferredList(repreneur.q12_geo_zones, repreneur.target_location)
  const canonicalValues = canonicalTargetThesisValues(
    selectedValues,
    WHEN_QUESTIONS.q12.options,
    "geography",
  )
  const allowedValues = new Set<string>(
    WHEN_QUESTIONS.q12.options.map((option) => option.value),
  )
  const knownValues = canonicalValues.filter((value) => allowedValues.has(value))
  const hasUnknownValue = canonicalValues.some((value) => !allowedValues.has(value))
  const opportunityLocationValues = normalizeList(opportunity.location)

  if (knownValues.length === 0 || opportunityLocationValues.length === 0) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: "Geography needs review because the current data is incomplete or not mapped.",
    }
  }

  const targetTerms = targetThesisMatchTerms(
    knownValues,
    WHEN_QUESTIONS.q12.options,
    "geography",
  ).map(normalizeText)
  const locationMatches = targetTerms.includes("all-france") ||
    hasTextMatch(opportunityLocationValues, targetTerms)

  if (locationMatches) {
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: "Location matches the repreneur geographic preference.",
    }
  }

  if (hasUnknownValue) {
    return {
      points: 0,
      knownWeight: 0,
      outcome: "review",
      reason: "Geography needs review because a target area is not mapped.",
    }
  }

  return {
    points: 0,
    knownWeight: weight,
    outcome: "mismatch",
    reason: "Location does not match the repreneur geographic preference.",
  }
}

function geographyCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const targetPaths = repreneur.target_geography_paths_stable_keys ?? []
  const opportunityPath = opportunity.geography_path_stable_keys ?? []
  const hasCanonicalIdentity = Boolean(
    opportunity.geography_node_id || targetPaths.length > 0,
  )

  if (hasCanonicalIdentity) {
    return canonicalGeographyCriterion(targetPaths, opportunityPath)
  }

  return legacyGeographyCriterion(repreneur, opportunity)
}

function sectorCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const weight = MATCHING_V2_CONFIG.weights.sector
  const opportunityValues = normalizeList(
    opportunity.sector,
    opportunity.activity,
    sectorCompatibilityValues(opportunity.sector),
  )
  const targetValues = targetThesisMatchTerms(
    preferredList(repreneur.q13_target_sectors_v2, repreneur.sector_preferences),
    WHEN_QUESTIONS.q13.options,
    "sector",
  ).map(normalizeText)
  const sectorMatches = targetValues.includes("all")
    ? true
    : hasTextMatch(opportunityValues, targetValues)

  if (sectorMatches === true) {
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: "Sector or activity matches the repreneur target preference.",
    }
  }

  if (sectorMatches === false) {
    return {
      points: 0,
      knownWeight: weight,
      outcome: "mismatch",
      reason: "Sector or activity does not match the repreneur target preferences.",
    }
  }

  return {
    points: 0,
    knownWeight: 0,
    outcome: "review",
    reason: "Sector fit needs review because the current data is incomplete.",
  }
}

export function calculateOpportunityMatchScore(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): OpportunityMatchScoreResult {
  const sector = sectorCriterion(repreneur, opportunity)
  const geography = geographyCriterion(repreneur, opportunity)
  const revenue = rangeCriterion(
    toNumber(opportunity.revenue_meur),
    toNumber(repreneur.target_revenue_min_meur),
    toNumber(repreneur.target_revenue_max_meur),
    MATCHING_V2_CONFIG.weights.revenue,
    "Revenue",
  )
  const ebitdaMargin = ebitdaMarginCriterion(repreneur, opportunity)
  const headcount = rangeCriterion(
    toNumber(opportunity.headcount),
    toNumber(repreneur.target_staff_size_min),
    toNumber(repreneur.target_staff_size_max),
    MATCHING_V2_CONFIG.weights.headcount,
    "Headcount",
  )
  const criteria = [sector, geography, revenue, ebitdaMargin, headcount]
  const knownWeight = criteria.reduce(
    (total, criterion) => total + criterion.knownWeight,
    0,
  )
  const availablePoints = criteria.reduce(
    (total, criterion) => total + criterion.points,
    0,
  )
  const normalizedScore = knownWeight > 0
    ? (availablePoints / knownWeight) * 100
    : 0

  let scoreCap = 100
  if (criteria.some((criterion) => criterion.outcome === "review")) {
    scoreCap = MATCHING_V2_CONFIG.evidence.reviewMaximumScore
  }
  if (sector.outcome === "mismatch") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.sectorMismatch)
  } else if (sector.outcome === "review") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.sectorReview)
  }
  if (geography.outcome === "mismatch") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.geographyMismatch)
  } else if (geography.outcome === "review") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.geographyReview)
  }
  if (revenue.outcome === "mismatch") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.revenueMismatch)
  }
  if (ebitdaMargin.outcome === "mismatch") {
    scoreCap = Math.min(
      scoreCap,
      MATCHING_V2_CONFIG.placementCaps.ebitdaMarginMismatch,
    )
  }
  if (headcount.outcome === "mismatch") {
    scoreCap = Math.min(scoreCap, MATCHING_V2_CONFIG.placementCaps.headcountMismatch)
  }

  const score = Math.round(clamp(normalizedScore, 0, scoreCap))
  return {
    score,
    recommendation: recommendationFromScore(score),
    reasons: criteria.map((criterion) => criterion.reason),
  }
}
