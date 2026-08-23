import type { OpportunityMatchRecommendation } from "@/lib/types/opportunity"
import { WHEN_QUESTIONS } from "@/lib/config/questionnaire-v2"
import { targetThesisMatchTerms } from "@/lib/repreneur-target-thesis"
import { sectorCompatibilityValues } from "@/lib/utils/opportunity-sector"

type ScoringRepreneur = {
  who_score?: number | null
  when_score?: number | null
  scoring_flags?: string[] | null
  q12_geo_zones?: string | string[] | null
  q13_target_sectors_v2?: string | string[] | null
  q14_deal_size?: string | string[] | null
  q16_equity?: string | null
  sector_preferences?: string | string[] | null
  target_location?: string | string[] | null
  target_acquisition_size?: string | null
  investment_capacity?: string | null
  // Collected for matching context, but intentionally excluded from the current score.
  target_revenue_min_meur?: number | string | null
  target_revenue_max_meur?: number | string | null
  target_ebitda_margin_min_pct?: number | string | null
  target_staff_size_min?: number | string | null
  target_staff_size_max?: number | string | null
}

type ScoringOpportunity = {
  sector?: string | null
  activity?: string | null
  location?: string | null
  revenue_meur?: number | string | null
  ebitda_keur?: number | string | null
  headcount?: number | string | null
}

export type OpportunityMatchScoreResult = {
  score: number
  recommendation: OpportunityMatchRecommendation
  reasons: string[]
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

function dealSizeBucket(revenueMeur: number | null) {
  if (revenueMeur === null) return null
  if (revenueMeur < 1) return "<1M"
  if (revenueMeur >= 1 && revenueMeur <= 3) return "1-3M"
  if (revenueMeur > 3 && revenueMeur <= 5) return "3-5M"
  if (revenueMeur > 5) return ">5M"
  return null
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

export function calculateOpportunityMatchScore(
  repreneur: ScoringRepreneur,
  opportunity: ScoringOpportunity,
): OpportunityMatchScoreResult {
  const reasons: string[] = []
  let score = 0
  let cap = 100
  let missingFitData = false
  let financialMismatch = false

  const whenScore = repreneur.when_score ?? null
  if (whenScore !== null) {
    score += clamp(whenScore, 0, 100) * 0.25
    reasons.push(`Readiness contributes ${Math.round(clamp(whenScore, 0, 100) * 0.25)}/25 from WHEN score.`)
    if (whenScore < 40) {
      cap = Math.min(cap, 55)
      reasons.push("WHEN score is below 40, so this match is capped until readiness improves.")
    }
  } else {
    score += 10
    missingFitData = true
    reasons.push("Readiness is not fully scored yet, so confidence is limited.")
  }

  const whoScore = repreneur.who_score ?? null
  if (whoScore !== null) {
    score += clamp(whoScore, 0, 100) * 0.2
    reasons.push(`Profile quality contributes ${Math.round(clamp(whoScore, 0, 100) * 0.2)}/20 from WHO score.`)
  } else {
    score += 8
    missingFitData = true
    reasons.push("Profile quality is not fully scored yet, so confidence is limited.")
  }

  const opportunitySectorValues = normalizeList(
    opportunity.sector,
    opportunity.activity,
    sectorCompatibilityValues(opportunity.sector),
  )
  const repreneurSectorValues = targetThesisMatchTerms(
    preferredList(repreneur.q13_target_sectors_v2, repreneur.sector_preferences),
    WHEN_QUESTIONS.q13.options,
    "sector",
  ).map(normalizeText)
  const sectorMatch = repreneurSectorValues.includes("all")
    ? true
    : hasTextMatch(opportunitySectorValues, repreneurSectorValues)
  if (sectorMatch === true) {
    score += 20
    reasons.push("Sector or activity matches the repreneur target preference.")
  } else if (sectorMatch === false) {
    score += 5
    reasons.push("Sector or activity is not clearly in the repreneur target preferences.")
  } else {
    score += 10
    missingFitData = true
    reasons.push("Sector fit cannot be fully confirmed from current data.")
  }

  const opportunityLocationValues = normalizeList(opportunity.location)
  const repreneurLocationValues = targetThesisMatchTerms(
    preferredList(repreneur.q12_geo_zones, repreneur.target_location),
    WHEN_QUESTIONS.q12.options,
    "geography",
  ).map(normalizeText)
  const locationMatch = repreneurLocationValues.includes("all-france")
    ? true
    : hasTextMatch(opportunityLocationValues, repreneurLocationValues)
  if (locationMatch === true) {
    score += 15
    reasons.push("Location matches the repreneur geographic preference.")
  } else if (locationMatch === false) {
    score += 4
    reasons.push("Location is not clearly in the repreneur geographic preference.")
  } else {
    score += 7
    missingFitData = true
    reasons.push("Geographic fit cannot be fully confirmed from current data.")
  }

  const opportunityBucket = dealSizeBucket(toNumber(opportunity.revenue_meur))
  const repreneurDealSizes = preferredList(repreneur.q14_deal_size, repreneur.target_acquisition_size)
  if (opportunityBucket && repreneurDealSizes.length > 0) {
    const targetBuckets = repreneurDealSizes.map((value) => value.toUpperCase())
    if (targetBuckets.includes(opportunityBucket.toUpperCase())) {
      score += 15
      reasons.push("Opportunity size appears aligned with the repreneur target range.")
    } else {
      score += 5
      financialMismatch = true
      reasons.push("Opportunity size does not clearly match the repreneur target range.")
    }
  } else {
    score += 8
    missingFitData = true
    reasons.push("Deal size fit cannot be fully confirmed from current data.")
  }

  const flags = Array.isArray(repreneur.scoring_flags) ? repreneur.scoring_flags.filter(Boolean) : []
  if (flags.length > 0) {
    const penalty = Math.min(flags.length * 5, 15)
    score -= penalty
    cap = Math.min(cap, 75)
    reasons.push(`Repreneur scoring flags reduce confidence by ${penalty} points.`)
  }

  if (missingFitData) cap = Math.min(cap, 70)
  if (financialMismatch) cap = Math.min(cap, 60)

  const finalScore = Math.round(clamp(score, 0, cap))

  return {
    score: finalScore,
    recommendation: recommendationFromScore(finalScore),
    reasons: reasons.slice(0, 6),
  }
}
