"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { scoreLeadershipAssessment } from "@/lib/utils/leadership-scoring"
import type { LeadershipFormData, LeadershipAssessment } from "@/lib/types/leadership-assessment"

/**
 * Create a new assessment for a repreneur and return the token URL
 */
export async function createAssessment(
  repreneurId: string,
  sentBy?: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Check if there's already a completed assessment (one-shot: cannot retake)
    const { data: completed } = await supabase
      .from("leadership_assessments")
      .select("id")
      .eq("repreneur_id", repreneurId)
      .not("completed_at", "is", null)
      .limit(1)
      .maybeSingle()

    if (completed) {
      return { success: false, error: "Assessment already completed. Leadership assessment can only be taken once." }
    }

    // Check if there's already an incomplete assessment
    const { data: existing } = await supabase
      .from("leadership_assessments")
      .select("id, token, completed_at")
      .eq("repreneur_id", repreneurId)
      .is("completed_at", null)
      .maybeSingle()

    if (existing) {
      // Return existing pending assessment token
      return { success: true, token: existing.token }
    }

    // Generate a unique token
    const token = crypto.randomUUID()

    const { error } = await supabase.from("leadership_assessments").insert({
      repreneur_id: repreneurId,
      token,
      sent_by: sentBy || null,
    })

    if (error) {
      console.error("Error creating assessment:", error)
      return { success: false, error: "Failed to create assessment" }
    }

    revalidatePath(`/repreneurs/${repreneurId}`)
    return { success: true, token }
  } catch (error) {
    console.error("Error in createAssessment:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Get assessment by token (public, no auth required)
 */
export async function getAssessmentByToken(
  token: string
): Promise<{ assessment: LeadershipAssessment | null; repreneur: { first_name: string; last_name: string } | null }> {
  const supabase = createAdminClient()

  // Fetch assessment
  const { data: assessment, error } = await supabase
    .from("leadership_assessments")
    .select("*")
    .eq("token", token)
    .maybeSingle()

  if (error || !assessment) {
    console.error("Assessment lookup error:", error)
    return { assessment: null, repreneur: null }
  }

  // Fetch repreneur name separately
  const { data: repreneur } = await supabase
    .from("repreneurs")
    .select("first_name, last_name")
    .eq("id", assessment.repreneur_id)
    .single()

  return {
    assessment: assessment as LeadershipAssessment,
    repreneur: repreneur || null,
  }
}

/**
 * Submit completed assessment (public, no auth required)
 * Scores the assessment and updates the repreneur's milestone if decision = engagement
 */
export async function submitAssessment(
  token: string,
  answers: LeadershipFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Get assessment
    const { data: assessment, error: fetchError } = await supabase
      .from("leadership_assessments")
      .select("id, repreneur_id, completed_at")
      .eq("token", token)
      .maybeSingle()

    if (fetchError || !assessment) {
      return { success: false, error: "Assessment not found" }
    }

    if (assessment.completed_at) {
      return { success: false, error: "This assessment has already been completed" }
    }

    // Score the assessment
    const result = scoreLeadershipAssessment(answers)

    // Update assessment with answers and scores
    const { error: updateError } = await supabase
      .from("leadership_assessments")
      .update({
        // Bloc A answers
        a1: answers.a1 || null,
        a2: answers.a2 || null,
        a3: answers.a3 || null,
        a4: answers.a4 || null,
        a5: answers.a5 || null,
        a6: answers.a6 || null,
        a7: answers.a7 || null,
        a8: answers.a8 || null,
        a9: answers.a9 || null,
        a10: answers.a10 || null,
        // Bloc B answers
        b1: answers.b1 || null,
        b2: answers.b2 || null,
        b3: answers.b3 || null,
        b4: answers.b4 || null,
        b5: answers.b5 || null,
        b6: answers.b6 || null,
        b7: answers.b7 || null,
        b8: answers.b8 || null,
        // Bloc C answers
        c1: answers.c1 || null,
        c2: answers.c2 || null,
        c3: answers.c3 || null,
        c4: answers.c4 || null,
        c5: answers.c5 || null,
        c6: answers.c6 || null,
        c7: answers.c7 || null,
        c8: answers.c8 || null,
        // Computed scores
        bloc_a_radar: result.blocA,
        bloc_b_total: result.blocB.total,
        bloc_b_tags: result.blocB.tags,
        bloc_b_minus2_count: result.blocB.minus2Count,
        bloc_c_risk_index: result.blocC.riskIndex,
        decision: result.decision,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assessment.id)

    if (updateError) {
      console.error("Error updating assessment:", updateError)
      return { success: false, error: "Failed to save assessment" }
    }

    // Update repreneur: link assessment and auto-toggle milestone
    const repreneurUpdate: Record<string, any> = {
      leadership_assessment_id: assessment.id,
    }

    // Auto-toggle leadership milestone if decision is "engagement"
    if (result.decision === "engagement") {
      repreneurUpdate.ms_leadership_assessment_passed = true
    }

    const { error: repreneurError } = await supabase
      .from("repreneurs")
      .update(repreneurUpdate)
      .eq("id", assessment.repreneur_id)

    if (repreneurError) {
      console.error("Error updating repreneur:", repreneurError)
      // Don't fail — assessment is saved, repreneur update is secondary
    }

    revalidatePath(`/repreneurs/${assessment.repreneur_id}`)
    return { success: true }
  } catch (error) {
    console.error("Error in submitAssessment:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

/**
 * Get the latest completed assessment for a repreneur (team view)
 */
export async function getLatestAssessment(
  repreneurId: string
): Promise<LeadershipAssessment | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("leadership_assessments")
    .select("*")
    .eq("repreneur_id", repreneurId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as LeadershipAssessment
}

/**
 * Get pending (incomplete) assessment for a repreneur
 */
export async function getPendingAssessment(
  repreneurId: string
): Promise<{ token: string; created_at: string } | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("leadership_assessments")
    .select("token, created_at")
    .eq("repreneur_id", repreneurId)
    .is("completed_at", null)
    .maybeSingle()

  if (error || !data) return null
  return data
}
