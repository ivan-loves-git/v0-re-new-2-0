export type EvaluationTier = "tier1" | "tier2" | "tier3"

/**
 * Raw database row from evaluation_criteria table
 */
export interface EvaluationCriterion {
  id: string
  tier: EvaluationTier
  question_key: string
  question_label: string
  question_order: number
  option_value: string | null
  option_label: string | null
  option_score: number | null
  option_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

/**
 * Option within a question (for display)
 */
export interface EvaluationOption {
  id: string
  option_value: string
  option_label: string
  option_score: number | null
  option_order: number
}

/**
 * Question with its options (grouped for UI)
 */
export interface EvaluationQuestion {
  question_key: string
  question_label: string
  question_order: number
  options: EvaluationOption[]
  // For informational questions (like Q3, Q4, Q7, Q11, Q13)
  is_informational: boolean
}

/**
 * Update payload for a single criterion
 */
export interface UpdateCriterionPayload {
  id: string
  option_label?: string
  option_score?: number | null
}

/**
 * Update payload for a question label
 */
export interface UpdateQuestionLabelPayload {
  question_key: string
  tier: EvaluationTier
  question_label: string
}
