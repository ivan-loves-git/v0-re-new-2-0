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
  return Math.max(min, min, max)
}
