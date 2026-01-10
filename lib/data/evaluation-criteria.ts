import { createServerClient } from "@/lib/supabase/server"
import type {
  EvaluationCriterion,
  EvaluationQuestion,
  EvaluationTier,
} from "@/lib/types/evaluation-criteria"

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
