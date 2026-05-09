/**
 * Fetch and transform evaluation criteria for the intake form
 * This connects the public intake form to the evaluation_criteria database table
 */

import { createServerClient } from "@/lib/supabase/server"
import type { QuestionOption } from "@/components/questionnaire/types"

// Static fallback options (from tier1-scoring.ts)
// Used if database fetch fails
import {
  EMPLOYMENT_STATUS_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  EXECUTIVE_ROLE_OPTIONS,
  JOURNEY_STAGE_OPTIONS,
  INVESTMENT_CAPACITY_OPTIONS,
  FUNDING_STATUS_OPTIONS,
  NETWORK_TRAINING_OPTIONS,
  INDUSTRY_SECTOR_OPTIONS,
  TARGET_ACQUISITION_SIZE_OPTIONS,
  TARGET_LOCATION_OPTIONS,
} from "@/lib/utils/tier1-scoring"

// Map of question keys to their static fallback options
const STATIC_FALLBACKS: Record<string, readonly { value: string; label: string; score?: number }[]> = {
  q1_employment_status: EMPLOYMENT_STATUS_OPTIONS,
  q2_years_experience: YEARS_EXPERIENCE_OPTIONS,
  q5_team_size: TEAM_SIZE_OPTIONS,
  q8_executive_roles: EXECUTIVE_ROLE_OPTIONS,
  q10_journey_stages: JOURNEY_STAGE_OPTIONS,
  q14_investment_capacity: INVESTMENT_CAPACITY_OPTIONS,
  q15_funding_status: FUNDING_STATUS_OPTIONS,
  q16_network_training: NETWORK_TRAINING_OPTIONS,
  q3_industry_sectors: INDUSTRY_SECTOR_OPTIONS,
  q11_target_sectors: INDUSTRY_SECTOR_OPTIONS,
  target_acquisition_size: TARGET_ACQUISITION_SIZE_OPTIONS,
  target_location: TARGET_LOCATION_OPTIONS,
}

export interface DynamicCriteriaMap {
  [questionKey: string]: QuestionOption[]
}

/**
 * Fetch Tier 1 criteria from the database and transform to QuestionOption format
 * Returns a map of question_key -> options array
 */
export async function getIntakeCriteria(): Promise<DynamicCriteriaMap> {
  try {
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from("evaluation_criteria")
      .select("question_key, option_value, option_label, option_score, option_order")
      .eq("tier", "tier1")
      .eq("is_active", true)
      .not("option_value", "eq", "_info") // Skip informational markers
      .order("question_key")
      .order("option_order", { ascending: true })

    if (error) {
      console.error("Error fetching intake criteria:", error)
      return getStaticFallback()
    }

    if (!data || data.length === 0) {
      console.warn("No criteria found in database, using static fallback")
      return getStaticFallback()
    }

    // Group by question_key
    const criteriaMap: DynamicCriteriaMap = {}

    for (const row of data) {
      if (!row.option_value || !row.option_label) continue

      if (!criteriaMap[row.question_key]) {
        criteriaMap[row.question_key] = []
      }

      criteriaMap[row.question_key].push({
        value: row.option_value,
        label: row.option_label,
        score: row.option_score ?? undefined,
      })
    }

    // Merge with static fallbacks for questions not in DB
    // (like industry sectors, target location, etc.)
    for (const [key, options] of Object.entries(STATIC_FALLBACKS)) {
      if (!criteriaMap[key] || criteriaMap[key].length === 0) {
        criteriaMap[key] = options.map(opt => ({
          value: opt.value,
          label: opt.label,
          score: opt.score,
        }))
      }
    }

    return criteriaMap
  } catch (error) {
    console.error("Failed to fetch intake criteria:", error)
    return getStaticFallback()
  }
}

/**
 * Get static fallback options when database is unavailable
 */
function getStaticFallback(): DynamicCriteriaMap {
  const fallback: DynamicCriteriaMap = {}

  for (const [key, options] of Object.entries(STATIC_FALLBACKS)) {
    fallback[key] = options.map(opt => ({
      value: opt.value,
      label: opt.label,
      score: opt.score,
    }))
  }

  return fallback
}
