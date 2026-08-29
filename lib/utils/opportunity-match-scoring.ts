import type { OpportunityMatchRecommendation } from "@/lib/types/opportunity"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import {
  canonicalTargetThesisValues,
  targetThesisMatchTerms,
} from "@/lib/repreneur-target-thesis"
import { sectorCompatibilityValues } from "@/lib/utils/opportunity-sector"

/** Matching 2.1 candidate; Matching 2.0 remains live until separately released. */
export const MATCHING_V2_CONFIG = {
  version: "2.1-candidate-2026-08-29",
  weights: { revenue: 36, absoluteEbitda: 29, ebitdaMargin: 21, headcount: 14 },
  rangeBuffers: { lower: 0.9, upper: 1.3 },
  evidence: { reviewMaximumScore: 70 },
} as const

type ScoringRepreneur = {
  // Legacy qualification inputs remain accepted but are never scored.
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  is_demo?: boolean | null
  q12_geo_zones?: string | string[] | null
  q13_target_sectors_v2?: string | string[] | null
  sector_preferences?: string | string[] | null
  target_location?: string | string[] | null
  target_revenue_min_meur?: number | string | null
  target_revenue_max_meur?: number | string | null
  target_ebitda_min_keur?: number | string | null
  target_ebitda_max_keur?: number | string | null
  target_ebitda_margin_min_pct?: number | string | null
  target_staff_size_min?: number | string | null
  target_staff_size_max?: number | string | null
  target_geography_paths_stable_keys?: string[][] | null
}
type ScoringOpportunity = {
  is_demo?: boolean | null
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | string | null
  ebitda_keur?: number | string | null
  headcount?: number | string | null
  geography_node_id?: string | null
  geography_path_stable_keys?: string[] | null
}
export type OpportunityMatchScoreResult = {
  score: number
  recommendation: OpportunityMatchRecommendation
  reasons: string[]
}
type CriterionOutcome =
  | "match"
  | "partial"
  | "review"
  | "omitted"
  | "hard_exclusion"
type CriterionResult = {
  points: number
  knownWeight: number
  outcome: CriterionOutcome
  reason: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
const normalizeText = (value: string | null | undefined) =>
  value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase() ?? ""
const toTextList = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value : value ? [value] : []
const normalizeList = (
  ...values: Array<string | string[] | null | undefined>
) => values.flatMap(toTextList).map(normalizeText).filter(Boolean)
function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
function hasTextMatch(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return null
  return source.some((candidate) =>
    target.some((term) => candidate.includes(term) || term.includes(candidate)),
  )
}
function preferredList(
  canonical: string | string[] | null | undefined,
  legacy: string | string[] | null | undefined,
) {
  const values = normalizeList(canonical)
  return values.length > 0 ? values : normalizeList(legacy)
}

/**
 * Imported activity labels are not a second sector taxonomy. Keep the one
 * reviewed spelling bridge explicit so arbitrary free text cannot fall into
 * a generic sector such as `Autre`.
 */
function reviewedActivitySectorAliases(activity: string | null | undefined) {
  return normalizeText(activity) === "btp / construction"
    ? ["BTP & Construction"]
    : []
}

function recommendationFromScore(
  score: number,
): OpportunityMatchRecommendation {
  if (score >= 80) return "strong_fit"
  if (score >= 65) return "possible_fit"
  if (score >= 45) return "weak_fit"
  return "not_fit"
}
const omitted = (label: string): CriterionResult => ({
  points: 0,
  knownWeight: 0,
  outcome: "omitted",
  reason: `${label} is not targeted by this repreneur.`,
})
const review = (label: string, detail: string): CriterionResult => ({
  points: 0,
  knownWeight: 0,
  outcome: "review",
  reason: `${label} needs review because ${detail}.`,
})

function numericRangeCriterion(
  value: number | null,
  minimum: number | null,
  maximum: number | null,
  weight: number,
  label: string,
  allowNegativeValue = false,
): CriterionResult {
  if (minimum === null && maximum === null) return omitted(label)
  if (
    (minimum !== null && minimum < 0) ||
    (maximum !== null && maximum < 0) ||
    (minimum !== null && maximum !== null && minimum > maximum)
  )
    return review(label, "the target range is invalid")
  if (value === null || (!allowNegativeValue && value < 0)) {
    return review(label, "the opportunity value is missing or invalid")
  }
  if (minimum !== null && value < minimum) {
    const lower = minimum * MATCHING_V2_CONFIG.rangeBuffers.lower
    if (value < lower)
      return {
        points: 0,
        knownWeight: weight,
        outcome: "hard_exclusion",
        reason: `${label} is below the 90% lower eligibility boundary.`,
      }
    return {
      points: weight * clamp((value - lower) / (minimum - lower || 1), 0, 1),
      knownWeight: weight,
      outcome: "partial",
      reason: `${label} is within the lower buffer.`,
    }
  }
  if (maximum !== null && value > maximum) {
    const upper = maximum * MATCHING_V2_CONFIG.rangeBuffers.upper
    if (value > upper)
      return {
        points: 0,
        knownWeight: weight,
        outcome: "hard_exclusion",
        reason: `${label} is above the 130% upper eligibility boundary.`,
      }
    return {
      points: weight * clamp((upper - value) / (upper - maximum || 1), 0, 1),
      knownWeight: weight,
      outcome: "partial",
      reason: `${label} is within the upper buffer.`,
    }
  }
  return {
    points: weight,
    knownWeight: weight,
    outcome: "match",
    reason: `${label} is within the target range.`,
  }
}

function ebitdaMarginCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const threshold = toNumber(repreneur.target_ebitda_margin_min_pct)
  const weight = MATCHING_V2_CONFIG.weights.ebitdaMargin
  if (threshold === null) return omitted("EBITDA margin")
  if (threshold < 0)
    return review("EBITDA margin", "the target threshold is invalid")
  const revenue = toNumber(opportunity.revenue_meur)
  const ebitda = toNumber(opportunity.ebitda_keur)
  if (revenue === null || ebitda === null || revenue <= 0)
    return review(
      "EBITDA margin",
      "opportunity revenue or EBITDA is missing or invalid",
    )
  const margin = (ebitda / (revenue * 1_000)) * 100
  if (threshold === 0)
    return margin < 0
      ? {
          points: 0,
          knownWeight: weight,
          outcome: "hard_exclusion",
          reason: "EBITDA margin is below the 0% eligibility threshold.",
        }
      : {
          points: weight,
          knownWeight: weight,
          outcome: "match",
          reason: "EBITDA margin meets the 0% target.",
        }
  const lower = threshold * 0.9
  if (margin < lower)
    return {
      points: 0,
      knownWeight: weight,
      outcome: "hard_exclusion",
      reason: "EBITDA margin is below the 90% eligibility boundary.",
    }
  if (margin <= threshold)
    return {
      points:
        weight * 0.6 * clamp((margin - lower) / (threshold - lower), 0, 1),
      knownWeight: weight,
      outcome: "partial",
      reason: "EBITDA margin is in the lower buffer.",
    }
  if (margin < threshold * 2)
    return {
      points:
        weight * (0.6 + 0.4 * clamp((margin - threshold) / threshold, 0, 1)),
      knownWeight: weight,
      outcome: "partial",
      reason: "EBITDA margin is above the target and below the cap.",
    }
  return {
    points: weight,
    knownWeight: weight,
    outcome: "match",
    reason: "EBITDA margin meets the capped target.",
  }
}

function headcountCriterion(
  value: number | null,
  minimum: number | null,
  maximum: number | null,
): CriterionResult {
  const label = "Headcount"
  const weight = MATCHING_V2_CONFIG.weights.headcount
  if (minimum === null && maximum === null) return omitted(label)
  if (
    (minimum !== null && minimum < 0) ||
    (maximum !== null && maximum < 0) ||
    (minimum !== null && maximum !== null && minimum > maximum)
  )
    return review(label, "the target range is invalid")
  if (value === null || value < 0)
    return review(label, "the opportunity value is missing or invalid")
  if (
    (minimum === null || value >= minimum) &&
    (maximum === null || value <= maximum)
  )
    return {
      points: weight,
      knownWeight: weight,
      outcome: "match",
      reason: "Headcount is within the target range.",
    }
  // One-sided targets use their known bound as a finite width. A zero-width target
  // scores only exact equality. Neither case makes a pair ineligible.
  const width =
    minimum !== null && maximum !== null
      ? maximum - minimum
      : Math.abs(minimum ?? maximum ?? 0)
  if (width === 0)
    return {
      points: 0,
      knownWeight: weight,
      outcome: "partial",
      reason: "Headcount is outside the zero-width target.",
    }
  const boundary = minimum !== null && value < minimum ? minimum : maximum!
  return {
    points: weight * clamp(1 - Math.abs(value - boundary) / width, 0, 1),
    knownWeight: weight,
    outcome: "partial",
    reason: "Headcount is outside the target range.",
  }
}

function geographyCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const targetPaths = repreneur.target_geography_paths_stable_keys ?? []
  const opportunityPath = opportunity.geography_path_stable_keys ?? []
  if (opportunity.geography_node_id || targetPaths.length > 0) {
    if (targetPaths.length === 0 || opportunityPath.length === 0)
      return review(
        "Geography",
        "one side has not been mapped to the France hierarchy",
      )
    const targetNodes = targetPaths.map((path) => path[0]).filter(Boolean)
    if (targetNodes.some((node) => opportunityPath.includes(node)))
      return {
        points: 0,
        knownWeight: 0,
        outcome: "match",
        reason: "Geography matches the canonical France hierarchy.",
      }
    if (targetPaths.some((path) => path.includes(opportunityPath[0])))
      return review(
        "Geography",
        "the opportunity is broader than the target area",
      )
    return {
      points: 0,
      knownWeight: 0,
      outcome: "hard_exclusion",
      reason: "Geography does not match the canonical France hierarchy.",
    }
  }
  const canonical = canonicalTargetThesisValues(
    preferredList(repreneur.q12_geo_zones, repreneur.target_location),
    WHEN_QUESTIONS.q12.options,
    "geography",
  )
  const allowed = new Set<string>(
    WHEN_QUESTIONS.q12.options.map((option) => option.value),
  )
  const known = canonical.filter((value) => allowed.has(value))
  const locations = normalizeList(opportunity.location)
  if (
    known.length === 0 ||
    locations.length === 0 ||
    canonical.some((value) => !allowed.has(value))
  )
    return review("Geography", "the current data is incomplete or not mapped")
  const terms = targetThesisMatchTerms(
    known,
    WHEN_QUESTIONS.q12.options,
    "geography",
  ).map(normalizeText)
  if (terms.includes("all-france") || hasTextMatch(locations, terms))
    return {
      points: 0,
      knownWeight: 0,
      outcome: "match",
      reason: "Location matches the repreneur geographic preference.",
    }
  return {
    points: 0,
    knownWeight: 0,
    outcome: "hard_exclusion",
    reason: "Location does not match the repreneur geographic preference.",
  }
}

function sectorCriterion(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): CriterionResult {
  const opportunityValues = normalizeList(
    opportunity.sector,
    opportunity.activity,
    sectorCompatibilityValues(opportunity.sector),
    reviewedActivitySectorAliases(opportunity.activity),
  )
  const targetValues = targetThesisMatchTerms(
    preferredList(
      repreneur.q13_target_sectors_v2,
      repreneur.sector_preferences,
    ),
    WHEN_QUESTIONS.q13.options,
    "sector",
  ).map(normalizeText)
  const matches = targetValues.includes("all")
    ? true
    : hasTextMatch(opportunityValues, targetValues)
  if (matches === true)
    return {
      points: 0,
      knownWeight: 0,
      outcome: "match",
      reason: "Sector or activity matches the repreneur target preference.",
    }
  if (matches === false)
    return {
      points: 0,
      knownWeight: 0,
      outcome: "hard_exclusion",
      reason:
        "Sector or activity does not match the repreneur target preferences.",
    }
  return review("Sector fit", "the current data is incomplete")
}

export function calculateOpportunityMatchScore(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): OpportunityMatchScoreResult {
  if (
    typeof repreneur.is_demo === "boolean" &&
    typeof opportunity.is_demo === "boolean" &&
    repreneur.is_demo !== opportunity.is_demo
  )
    return {
      score: 0,
      recommendation: "not_fit",
      reasons: ["REAL and DEMO records cannot be matched."],
    }
  const criteria = [
    sectorCriterion(repreneur, opportunity),
    geographyCriterion(repreneur, opportunity),
    numericRangeCriterion(
      toNumber(opportunity.revenue_meur),
      toNumber(repreneur.target_revenue_min_meur),
      toNumber(repreneur.target_revenue_max_meur),
      MATCHING_V2_CONFIG.weights.revenue,
      "Revenue",
    ),
    numericRangeCriterion(
      toNumber(opportunity.ebitda_keur),
      toNumber(repreneur.target_ebitda_min_keur),
      toNumber(repreneur.target_ebitda_max_keur),
      MATCHING_V2_CONFIG.weights.absoluteEbitda,
      "Absolute EBITDA",
      true,
    ),
    ebitdaMarginCriterion(repreneur, opportunity),
    headcountCriterion(
      toNumber(opportunity.headcount),
      toNumber(repreneur.target_staff_size_min),
      toNumber(repreneur.target_staff_size_max),
    ),
  ]
  if (criteria.some((criterion) => criterion.outcome === "hard_exclusion"))
    return {
      score: 0,
      recommendation: "not_fit",
      reasons: criteria.map((criterion) => criterion.reason),
    }
  const knownWeight = criteria.reduce(
    (total, criterion) => total + criterion.knownWeight,
    0,
  )
  const points = criteria.reduce(
    (total, criterion) => total + criterion.points,
    0,
  )
  const needsReview =
    criteria.some((criterion) => criterion.outcome === "review") ||
    knownWeight === 0
  const score = Math.round(
    clamp(
      knownWeight > 0 ? (points / knownWeight) * 100 : 0,
      0,
      needsReview ? MATCHING_V2_CONFIG.evidence.reviewMaximumScore : 100,
    ),
  )
  return {
    score,
    recommendation: recommendationFromScore(score),
    reasons: criteria.map((criterion) => criterion.reason),
  }
}
