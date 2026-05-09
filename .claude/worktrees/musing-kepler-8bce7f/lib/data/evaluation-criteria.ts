import { createServerClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  EvaluationCriterion,
  EvaluationQuestion,
  EvaluationTier,
} from "@/lib/types/evaluation-criteria"

/**
 * Scoring lookup map: question_key -> option_value -> score
 * Used by the scoring algorithm to look up scores from database
 */
export type ScoringCriteriaMap = Map<string, Map<string, number>>

/**
 * Fetch all evaluation criteria for a specific tier
 */
export async function getEvaluationCriteria(
  tier: EvaluationTier
): Promise<EvaluationCriterion[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("evaluation_criteria")
    .select("*")
    .eq("tier", tier)
    .eq("is_active", true)
    .order("question_order", { ascending: true })
    .order("option_order", { ascending: true })

  if (error) {
    console.error("Error fetching evaluation criteria:", error)
    throw new Error(`Failed to fetch evaluation criteria: ${error.message}`)
  }

  return data as EvaluationCriterion[]
}

/**
 * Group flat criteria rows by question for UI display
 */
export function groupCriteriaByQuestion(
  criteria: EvaluationCriterion[]
): EvaluationQuestion[] {
  const grouped = new Map<string, EvaluationQuestion>()

  for (const criterion of criteria) {
    if (!grouped.has(criterion.question_key)) {
      // Check if this is an informational question (has _info option or no real options)
      const isInfo = criterion.option_value === "_info"

      grouped.set(criterion.question_key, {
        question_key: criterion.question_key,
        question_label: criterion.question_label,
        question_order: criterion.question_order,
        options: [],
        is_informational: isInfo,
      })
    }

    const question = grouped.get(criterion.question_key)!

    // Only add real options (not _info markers)
    if (criterion.option_value && criterion.option_value !== "_info") {
      question.options.push({
        id: criterion.id,
        option_value: criterion.option_value,
        option_label: criterion.option_label || "",
        option_score: criterion.option_score,
        option_order: criterion.option_order || 0,
      })
    }
  }

  // Sort by question order and return
  return Array.from(grouped.values()).sort(
    (a, b) => a.question_order - b.question_order
  )
}

/**
 * Convenience function to get grouped criteria
 */
export async function getGroupedEvaluationCriteria(
  tier: EvaluationTier
): Promise<EvaluationQuestion[]> {
  const criteria = await getEvaluationCriteria(tier)
  return groupCriteriaByQuestion(criteria)
}

/**
 * Fetch tier1 scoring criteria from database and return as lookup map
 * Used by calculateTier1Score() to use database values instead of hardcoded ones
 *
 * Uses admin client so it can be called from public intake form (no auth required)
 */
export async function getTier1ScoringCriteria(): Promise<ScoringCriteriaMap> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("evaluation_criteria")
    .select("question_key, option_value, option_score")
    .eq("tier", "tier1")
    .eq("is_active", true)
    .not("option_value", "is", null)
    .not("option_value", "eq", "_info")

  if (error) {
    console.error("Error fetching tier1 scoring criteria:", error)
    // Return empty map - scoring function will use fallback hardcoded values
    return new Map()
  }

  // Build nested lookup map: question_key -> option_value -> score
  const criteriaMap: ScoringCriteriaMap = new Map()

  for (const row of data) {
    if (!row.option_value || row.option_score === null) continue

    if (!criteriaMap.has(row.question_key)) {
      criteriaMap.set(row.question_key, new Map())
    }

    criteriaMap.get(row.question_key)!.set(row.option_value, row.option_score)
  }

  return criteriaMap
}
