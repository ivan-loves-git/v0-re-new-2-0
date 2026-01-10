"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { EvaluationTier } from "@/lib/types/evaluation-criteria"

/**
 * Update a single criterion's label and/or score
 */
export async function updateCriterion(
  id: string,
  updates: {
    option_label?: string
    option_score?: number | null
  }
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { error } = await supabase
    .from("evaluation_criteria")
    .update({
      ...updates,
      updated_by: user.id,
    })
    .eq("id", id)

  if (error) {
    throw new Error(`Failed to update criterion: ${error.message}`)
  }

  revalidatePath("/guide/evaluation")
  return { success: true }
}

/**
 * Update a question's label (updates all rows with the same question_key)
 */
export async function updateQuestionLabel(
  questionKey: string,
  tier: EvaluationTier,
  newLabel: string
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { error } = await supabase
    .from("evaluation_criteria")
    .update({
      question_label: newLabel,
      updated_by: user.id,
    })
    .eq("question_key", questionKey)
    .eq("tier", tier)

  if (error) {
    throw new Error(`Failed to update question label: ${error.message}`)
  }

  revalidatePath("/guide/evaluation")
  return { success: true }
}

/**
 * Batch update multiple criteria at once
 */
export async function updateMultipleCriteria(
  updates: Array<{
    id: string
    option_label?: string
    option_score?: number | null
  }>
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // Update each criterion
  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase
      .from("evaluation_criteria")
      .update({
        ...fields,
        updated_by: user.id,
      })
      .eq("id", id)

    if (error) {
      throw new Error(`Failed to update criterion ${id}: ${error.message}`)
    }
  }

  revalidatePath("/guide/evaluation")
  return { success: true }
}
