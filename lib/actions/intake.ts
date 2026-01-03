"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { calculateTier1Score, type Tier1ScoringInput } from "@/lib/utils/tier1-scoring"

// Return type for all intake actions
type IntakeResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Step 1: Create a draft repreneur with contact info only
 * This ensures we never lose the lead even if they abandon the form
 * NOTE: This action does NOT require authentication - it's for public intake
 */
export async function createIntakeDraft(data: {
  first_name: string
  last_name: string
  email: string
  phone?: string
  linkedin_url?: string
}): Promise<IntakeResult<{ id: string; isExisting: boolean }>> {
  try {
    const supabase = createAdminClient()

    // Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from("repreneurs")
      .select("id")
      .eq("email", data.email)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking existing email:", checkError)
      return { success: false, error: "Failed to check email. Please try again." }
    }

    if (existing) {
      // Return existing ID so they can continue
      return { success: true, data: { id: existing.id, isExisting: true } }
    }

    const { data: repreneur, error } = await supabase
      .from("repreneurs")
      .insert({
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone?.trim() || null,
        linkedin_url: data.linkedin_url?.trim() || null,
        lifecycle_status: "lead",
        source: "intake_form",
        consent_source: "intake_form",
      })
      .select("id")
      .single()

    if (error) {
      console.error("Error creating intake draft:", error)
      // Check for common errors
      if (error.code === "23505") {
        return { success: false, error: "This email is already registered." }
      }
      return { success: false, error: "Failed to save your information. Please try again." }
    }

    return { success: true, data: { id: repreneur.id, isExisting: false } }
  } catch (err) {
    console.error("Unexpected error in createIntakeDraft:", err)
    return { success: false, error: "An unexpected error occurred. Please try again." }
  }
}

/**
 * Step 2: Update professional background
 */
export async function updateIntakeBackground(
  id: string,
  data: {
    q1_employment_status: string | null
    q2_years_experience: string | null
    q3_industry_sectors: string[]
    q5_team_size: string | null
    q8_executive_roles: string[]
  }
): Promise<IntakeResult> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from("repreneurs")
      .update({
        q1_employment_status: data.q1_employment_status,
        q2_years_experience: data.q2_years_experience,
        q3_industry_sectors: data.q3_industry_sectors,
        q5_team_size: data.q5_team_size,
        q8_executive_roles: data.q8_executive_roles,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating intake background:", error)
      return { success: false, error: "Failed to save your background information." }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error("Unexpected error in updateIntakeBackground:", err)
    return { success: false, error: "An unexpected error occurred." }
  }
}

/**
 * Step 3: Update M&A experience
 */
export async function updateIntakeMAExperience(
  id: string,
  data: {
    q4_has_ma_experience: boolean | null
    q6_involved_in_ma: boolean | null
    q7_ma_details: string | null
    q9_board_experience: boolean | null
  }
): Promise<IntakeResult> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from("repreneurs")
      .update({
        q4_has_ma_experience: data.q4_has_ma_experience,
        q6_involved_in_ma: data.q6_involved_in_ma,
        q7_ma_details: data.q7_ma_details,
        q9_board_experience: data.q9_board_experience,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating intake M&A experience:", error)
      return { success: false, error: "Failed to save your M&A experience." }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error("Unexpected error in updateIntakeMAExperience:", err)
    return { success: false, error: "An unexpected error occurred." }
  }
}

/**
 * Step 4: Update acquisition goals
 */
export async function updateIntakeGoals(
  id: string,
  data: {
    q10_journey_stages: string[]
    q11_target_sectors: string[]
    target_location: string | null
    target_acquisition_size: string | null
    q12_has_identified_targets: boolean | null
    q13_target_details: string | null
  }
): Promise<IntakeResult> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from("repreneurs")
      .update({
        q10_journey_stages: data.q10_journey_stages,
        q11_target_sectors: data.q11_target_sectors,
        target_location: data.target_location,
        target_acquisition_size: data.target_acquisition_size,
        q12_has_identified_targets: data.q12_has_identified_targets,
        q13_target_details: data.q13_target_details,
        sector_preferences: data.q11_target_sectors,
      })
      .eq("id", id)

    if (error) {
      console.error("Error updating intake goals:", error)
      return { success: false, error: "Failed to save your acquisition goals." }
    }

    return { success: true, data: null }
  } catch (err) {
    console.error("Unexpected error in updateIntakeGoals:", err)
    return { success: false, error: "An unexpected error occurred." }
  }
}

/**
 * Step 5: Final step - Financial, network, consent & calculate score
 */
export async function completeIntake(
  id: string,
  data: {
    q14_investment_capacity: string | null
    q15_funding_status: string | null
    q16_network_training: string[]
    q17_open_to_co_acquisition: boolean | null
    marketing_consent: boolean
    source: string | null
  }
): Promise<IntakeResult<{ score: number }>> {
  try {
    const supabase = createAdminClient()

    // First, get existing questionnaire data to calculate score
    const { data: existing, error: fetchError } = await supabase
      .from("repreneurs")
      .select(`
        q1_employment_status,
        q2_years_experience,
        q3_industry_sectors,
        q4_has_ma_experience,
        q5_team_size,
        q6_involved_in_ma,
        q8_executive_roles,
        q9_board_experience,
        q10_journey_stages,
        q11_target_sectors,
        q12_has_identified_targets
      `)
      .eq("id", id)
      .single()

    if (fetchError) {
      console.error("Error fetching existing data:", fetchError)
      return { success: false, error: "Failed to retrieve your data. Please try again." }
    }

    // Calculate Tier 1 score with all data
    const scoringInput: Tier1ScoringInput = {
      q1_employment_status: existing.q1_employment_status,
      q2_years_experience: existing.q2_years_experience,
      q3_industry_sectors: existing.q3_industry_sectors || [],
      q4_has_ma_experience: existing.q4_has_ma_experience,
      q5_team_size: existing.q5_team_size,
      q6_involved_in_ma: existing.q6_involved_in_ma,
      q8_executive_roles: existing.q8_executive_roles || [],
      q9_board_experience: existing.q9_board_experience,
      q10_journey_stages: existing.q10_journey_stages || [],
      q11_target_sectors: existing.q11_target_sectors || [],
      q12_has_identified_targets: existing.q12_has_identified_targets,
      q14_investment_capacity: data.q14_investment_capacity,
      q15_funding_status: data.q15_funding_status,
      q16_network_training: data.q16_network_training,
      q17_open_to_co_acquisition: data.q17_open_to_co_acquisition,
    }

    const scoreBreakdown = calculateTier1Score(scoringInput)

    // Update with final data and score
    const { error } = await supabase
      .from("repreneurs")
      .update({
        q14_investment_capacity: data.q14_investment_capacity,
        q15_funding_status: data.q15_funding_status,
        q16_network_training: data.q16_network_training,
        q17_open_to_co_acquisition: data.q17_open_to_co_acquisition,
        investment_capacity: data.q14_investment_capacity,
        marketing_consent: data.marketing_consent,
        consent_timestamp: data.marketing_consent ? new Date().toISOString() : null,
        source: data.source || "intake_form",
        tier1_score: scoreBreakdown.total,
        tier1_score_breakdown: scoreBreakdown,
        questionnaire_completed_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      console.error("Error completing intake:", error)
      return { success: false, error: "Failed to complete your registration. Please try again." }
    }

    revalidatePath("/repreneurs")
    revalidatePath("/pipeline")
    revalidatePath("/dashboard")

    return { success: true, data: { score: scoreBreakdown.total } }
  } catch (err) {
    console.error("Unexpected error in completeIntake:", err)
    return { success: false, error: "An unexpected error occurred." }
  }
}
