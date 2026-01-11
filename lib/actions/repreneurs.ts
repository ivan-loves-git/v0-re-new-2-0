"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Repreneur_Insert, LifecycleStatus, PersonaType, Tier2Dimensions, MilestoneKey } from "@/lib/types/repreneur"
import { calculateTier2Overall, dimensionsToDbColumns } from "@/lib/utils/tier2-scoring"
import { milestonesToDbColumns, countMilestones, extractMilestones, deriveJourneyStage } from "@/lib/utils/journey-derivation"
import { calculateTier1Score, type Tier1ScoringInput } from "@/lib/utils/tier1-scoring"
import { getTier1ScoringCriteria } from "@/lib/data/evaluation-criteria"
import { sendEmail } from "@/lib/email"
import { RejectionEmail } from "@/lib/email/templates/rejection"

export async function createRepreneur(formData: FormData) {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // Parse sector preferences (now sent as JSON array)
  const sectorPrefsRaw = formData.get("sector_preferences") as string
  let sector_preferences: string[] = []
  if (sectorPrefsRaw) {
    try {
      sector_preferences = JSON.parse(sectorPrefsRaw)
    } catch {
      // Fallback to comma-separated for backwards compatibility
      sector_preferences = sectorPrefsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    }
  }

  // Parse marketing consent checkbox
  const marketingConsent = formData.get("marketing_consent") === "on"

  const repreneur: Repreneur_Insert = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
    linkedin_url: (formData.get("linkedin_url") as string) || undefined,
    company_background: (formData.get("company_background") as string) || undefined,
    investment_capacity: (formData.get("investment_capacity") as string) || undefined,
    sector_preferences: sector_preferences.length > 0 ? sector_preferences : undefined,
    target_location: (formData.get("target_location") as string) || undefined,
    target_acquisition_size: (formData.get("target_acquisition_size") as string) || undefined,
    lifecycle_status: (formData.get("lifecycle_status") as LifecycleStatus) || "lead",
    persona: (formData.get("persona") as PersonaType) || undefined,
    source: (formData.get("source") as string) || undefined,
    // GDPR Consent
    marketing_consent: marketingConsent,
    consent_timestamp: marketingConsent ? new Date().toISOString() : undefined,
    consent_source: (formData.get("consent_source") as string) || "manual",
    created_by: user.id,
  }

  const { data, error } = await supabase.from("repreneurs").insert(repreneur).select().single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  redirect(`/repreneurs/${data.id}`)
}

export async function updateRepreneur(id: string, formData: FormData) {
  const supabase = await createServerClient()

  // Parse sector preferences (now sent as JSON array)
  const sectorPrefsRaw = formData.get("sector_preferences") as string
  let sector_preferences: string[] = []
  if (sectorPrefsRaw) {
    try {
      sector_preferences = JSON.parse(sectorPrefsRaw)
    } catch {
      // Fallback to comma-separated for backwards compatibility
      sector_preferences = sectorPrefsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    }
  }

  // Parse marketing consent checkbox
  const marketingConsent = formData.get("marketing_consent") === "on"

  // Get existing repreneur to check if consent status changed
  const { data: existing } = await supabase
    .from("repreneurs")
    .select("marketing_consent")
    .eq("id", id)
    .single()

  // Only update consent_timestamp if consent status changed
  const consentChanged = existing?.marketing_consent !== marketingConsent

  const updates: Record<string, unknown> = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || null,
    linkedin_url: (formData.get("linkedin_url") as string) || null,
    company_background: (formData.get("company_background") as string) || null,
    investment_capacity: (formData.get("investment_capacity") as string) || null,
    sector_preferences: sector_preferences.length > 0 ? sector_preferences : null,
    target_location: (formData.get("target_location") as string) || null,
    target_acquisition_size: (formData.get("target_acquisition_size") as string) || null,
    lifecycle_status: formData.get("lifecycle_status") as LifecycleStatus,
    persona: (formData.get("persona") as string) || null,
    source: (formData.get("source") as string) || null,
    // GDPR Consent
    marketing_consent: marketingConsent,
  }

  // Update consent timestamp only if consent status changed
  if (consentChanged) {
    updates.consent_timestamp = new Date().toISOString()
    updates.consent_source = (formData.get("consent_source") as string) || "manual"
  }

  const { error } = await supabase.from("repreneurs").update(updates).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
}

export async function updateRepreneurStatus(id: string, status: LifecycleStatus) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("repreneurs").update({ lifecycle_status: status }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

export async function updateRepreneurJourneyStage(id: string, stage: string | null) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("repreneurs").update({ journey_stage: stage }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/journey")
}

export async function updateRepreneurField(id: string, field: string, value: string | string[] | null) {
  const supabase = await createServerClient()

  console.log(`[updateRepreneurField] Updating ${field} for ${id}`)

  const { error } = await supabase.from("repreneurs").update({ [field]: value }).eq("id", id)

  if (error) {
    console.error(`[updateRepreneurField] Database error:`, error)
    throw new Error(error.message)
  }

  console.log(`[updateRepreneurField] Database update successful, revalidating paths...`)

  try {
    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${id}`)
    revalidatePath("/pipeline")
    revalidatePath("/journey")
    console.log(`[updateRepreneurField] Revalidation complete`)
  } catch (revalidateError) {
    console.error(`[updateRepreneurField] Revalidation error:`, revalidateError)
    // Don't throw - the update succeeded, revalidation is secondary
  }
}

export async function createNote(repreneurId: string, content: string, noteType: string = "other") {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { error } = await supabase.from("notes").insert({
    repreneur_id: repreneurId,
    content,
    note_type: noteType,
    created_by: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteNote(noteId: string, repreneurId: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("notes").delete().eq("id", noteId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteRepreneur(id: string) {
  const supabase = await createServerClient()

  // Delete related records first (notes, repreneur_offers, activities)
  await supabase.from("notes").delete().eq("repreneur_id", id)
  await supabase.from("repreneur_offers").delete().eq("repreneur_id", id)
  await supabase.from("activities").delete().eq("repreneur_id", id)

  // Delete the repreneur
  const { error } = await supabase.from("repreneurs").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  redirect("/repreneurs")
}

/**
 * Set Tier 2 star rating (1-5) for a repreneur
 * This automatically sets lifecycle_status to "qualified" (action-driven status)
 */
export async function setTier2Stars(id: string, stars: number) {
  const supabase = await createServerClient()

  if (stars < 1 || stars > 5) {
    throw new Error("Star rating must be between 1 and 5")
  }

  // Setting Tier 2 stars automatically qualifies the repreneur
  const { error } = await supabase
    .from("repreneurs")
    .update({
      tier2_stars: stars,
      lifecycle_status: "qualified",
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Clear Tier 2 star rating (set back to null)
 * Does NOT change lifecycle_status - manual intervention required
 */
export async function clearTier2Stars(id: string) {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("repreneurs")
    .update({ tier2_stars: null })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Reject a repreneur
 * Stores the previous status for potential un-reject, sets rejected_at timestamp
 */
export async function rejectRepreneur(id: string) {
  const supabase = await createServerClient()

  // First, get the current status to store as previous_status
  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("lifecycle_status")
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Don't reject if already rejected
  if (repreneur.lifecycle_status === "rejected") {
    throw new Error("Repreneur is already rejected")
  }

  const { error } = await supabase
    .from("repreneurs")
    .update({
      lifecycle_status: "rejected",
      previous_status: repreneur.lifecycle_status,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  // Send rejection email
  const { data: repreneurData } = await supabase
    .from("repreneurs")
    .select("first_name, last_name, email")
    .eq("id", id)
    .single()

  if (repreneurData) {
    sendEmail({
      to: repreneurData.email,
      subject: "Mise à jour concernant votre candidature Re-New",
      repreneurId: id,
      templateKey: "rejection",
      react: RejectionEmail({
        repreneur: {
          id,
          firstName: repreneurData.first_name,
          lastName: repreneurData.last_name,
          email: repreneurData.email,
        },
      }),
    }).catch((err) => {
      console.error("Failed to send rejection email:", err)
    })
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Un-reject a repreneur (restore to previous status)
 */
export async function unrejectRepreneur(id: string) {
  const supabase = await createServerClient()

  // Get the previous status
  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("lifecycle_status, previous_status")
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Can only un-reject if currently rejected
  if (repreneur.lifecycle_status !== "rejected") {
    throw new Error("Repreneur is not rejected")
  }

  // Restore to previous status, or default to "lead" if no previous status
  const restoredStatus = repreneur.previous_status || "lead"

  const { error } = await supabase
    .from("repreneurs")
    .update({
      lifecycle_status: restoredStatus,
      previous_status: null,
      rejected_at: null,
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Questionnaire data input type
 */
export interface QuestionnaireInput {
  q1_employment_status: string | null
  q2_years_experience: string | null
  q3_industry_sectors: string[]
  q4_has_ma_experience: boolean | null
  q5_team_size: string | null
  q6_involved_in_ma: boolean | null
  q7_ma_details: string | null
  q8_executive_roles: string[]
  q9_board_experience: boolean | null
  q10_journey_stages: string[]
  q11_target_sectors: string[]
  q12_has_identified_targets: boolean | null
  q13_target_details: string | null
  q14_investment_capacity: string | null
  q15_funding_status: string | null
  q16_network_training: string[]
  q17_open_to_co_acquisition: boolean | null
}

/**
 * Save questionnaire data and calculate Tier 1 score
 * Score is calculated using database criteria (with hardcoded fallback)
 */
export async function saveQuestionnaire(id: string, data: QuestionnaireInput) {
  const supabase = await createServerClient()

  // Fetch scoring criteria from database (uses hardcoded fallback if DB fails)
  const scoringCriteria = await getTier1ScoringCriteria()

  // Calculate the Tier 1 score using database criteria
  const scoringInput: Tier1ScoringInput = {
    q1_employment_status: data.q1_employment_status,
    q2_years_experience: data.q2_years_experience,
    q3_industry_sectors: data.q3_industry_sectors,
    q4_has_ma_experience: data.q4_has_ma_experience,
    q5_team_size: data.q5_team_size,
    q6_involved_in_ma: data.q6_involved_in_ma,
    q8_executive_roles: data.q8_executive_roles,
    q9_board_experience: data.q9_board_experience,
    q10_journey_stages: data.q10_journey_stages,
    q11_target_sectors: data.q11_target_sectors,
    q12_has_identified_targets: data.q12_has_identified_targets,
    q14_investment_capacity: data.q14_investment_capacity,
    q15_funding_status: data.q15_funding_status,
    q16_network_training: data.q16_network_training,
    q17_open_to_co_acquisition: data.q17_open_to_co_acquisition,
  }

  const scoreBreakdown = calculateTier1Score(scoringInput, scoringCriteria)

  // Update the repreneur with questionnaire data and score
  const { error } = await supabase
    .from("repreneurs")
    .update({
      // Questionnaire fields
      q1_employment_status: data.q1_employment_status,
      q2_years_experience: data.q2_years_experience,
      q3_industry_sectors: data.q3_industry_sectors,
      q4_has_ma_experience: data.q4_has_ma_experience,
      q5_team_size: data.q5_team_size,
      q6_involved_in_ma: data.q6_involved_in_ma,
      q7_ma_details: data.q7_ma_details,
      q8_executive_roles: data.q8_executive_roles,
      q9_board_experience: data.q9_board_experience,
      q10_journey_stages: data.q10_journey_stages,
      q11_target_sectors: data.q11_target_sectors,
      q12_has_identified_targets: data.q12_has_identified_targets,
      q13_target_details: data.q13_target_details,
      q14_investment_capacity: data.q14_investment_capacity,
      q15_funding_status: data.q15_funding_status,
      q16_network_training: data.q16_network_training,
      q17_open_to_co_acquisition: data.q17_open_to_co_acquisition,
      // Score fields
      tier1_score: scoreBreakdown.total,
      tier1_score_breakdown: scoreBreakdown,
      questionnaire_completed_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")

  return scoreBreakdown
}

/**
 * Update a single tier one questionnaire field and recalculate score
 * Used by the inline editor on the profile page
 */
export async function updateTier1Answer(
  id: string,
  field: string,
  value: string | string[] | boolean | null
) {
  const supabase = await createServerClient()

  // First update the single field
  const { error: updateError } = await supabase
    .from("repreneurs")
    .update({ [field]: value })
    .eq("id", id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Fetch all current questionnaire data to recalculate score
  const { data: repreneur, error: fetchError } = await supabase
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
      q12_has_identified_targets,
      q14_investment_capacity,
      q15_funding_status,
      q16_network_training,
      q17_open_to_co_acquisition
    `)
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Fetch scoring criteria and recalculate
  const scoringCriteria = await getTier1ScoringCriteria()

  const scoringInput: Tier1ScoringInput = {
    q1_employment_status: repreneur.q1_employment_status,
    q2_years_experience: repreneur.q2_years_experience,
    q3_industry_sectors: repreneur.q3_industry_sectors || [],
    q4_has_ma_experience: repreneur.q4_has_ma_experience,
    q5_team_size: repreneur.q5_team_size,
    q6_involved_in_ma: repreneur.q6_involved_in_ma,
    q8_executive_roles: repreneur.q8_executive_roles || [],
    q9_board_experience: repreneur.q9_board_experience,
    q10_journey_stages: repreneur.q10_journey_stages || [],
    q11_target_sectors: repreneur.q11_target_sectors || [],
    q12_has_identified_targets: repreneur.q12_has_identified_targets,
    q14_investment_capacity: repreneur.q14_investment_capacity,
    q15_funding_status: repreneur.q15_funding_status,
    q16_network_training: repreneur.q16_network_training || [],
    q17_open_to_co_acquisition: repreneur.q17_open_to_co_acquisition,
  }

  const scoreBreakdown = calculateTier1Score(scoringInput, scoringCriteria)

  // Update the score
  const { error: scoreError } = await supabase
    .from("repreneurs")
    .update({
      tier1_score: scoreBreakdown.total,
      tier1_score_breakdown: scoreBreakdown,
    })
    .eq("id", id)

  if (scoreError) {
    throw new Error(scoreError.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")

  return scoreBreakdown
}

/**
 * Update all Tier 1 questionnaire answers at once and recalculate score
 * Used by the batch editor dialog
 */
export async function updateTier1Answers(
  id: string,
  answers: Record<string, string | string[] | boolean | null>
) {
  const supabase = await createServerClient()

  // Update all fields at once
  const { error: updateError } = await supabase
    .from("repreneurs")
    .update(answers)
    .eq("id", id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Fetch all current questionnaire data to recalculate score
  const { data: repreneur, error: fetchError } = await supabase
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
      q12_has_identified_targets,
      q14_investment_capacity,
      q15_funding_status,
      q16_network_training,
      q17_open_to_co_acquisition
    `)
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Fetch scoring criteria and recalculate
  const scoringCriteria = await getTier1ScoringCriteria()

  const scoringInput: Tier1ScoringInput = {
    q1_employment_status: repreneur.q1_employment_status,
    q2_years_experience: repreneur.q2_years_experience,
    q3_industry_sectors: repreneur.q3_industry_sectors || [],
    q4_has_ma_experience: repreneur.q4_has_ma_experience,
    q5_team_size: repreneur.q5_team_size,
    q6_involved_in_ma: repreneur.q6_involved_in_ma,
    q8_executive_roles: repreneur.q8_executive_roles || [],
    q9_board_experience: repreneur.q9_board_experience,
    q10_journey_stages: repreneur.q10_journey_stages || [],
    q11_target_sectors: repreneur.q11_target_sectors || [],
    q12_has_identified_targets: repreneur.q12_has_identified_targets,
    q14_investment_capacity: repreneur.q14_investment_capacity,
    q15_funding_status: repreneur.q15_funding_status,
    q16_network_training: repreneur.q16_network_training || [],
    q17_open_to_co_acquisition: repreneur.q17_open_to_co_acquisition,
  }

  const scoreBreakdown = calculateTier1Score(scoringInput, scoringCriteria)

  // Update the score
  const { error: scoreError } = await supabase
    .from("repreneurs")
    .update({
      tier1_score: scoreBreakdown.total,
      tier1_score_breakdown: scoreBreakdown,
    })
    .eq("id", id)

  if (scoreError) {
    throw new Error(scoreError.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")

  return scoreBreakdown
}

/**
 * Set Tier 2 competency dimensions (6 dimensions with weighted average)
 * This automatically sets lifecycle_status to "qualified" (action-driven status)
 */
export async function setTier2Dimensions(id: string, dimensions: Partial<Tier2Dimensions>) {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Calculate weighted overall score
  const overall = calculateTier2Overall(dimensions)

  // Convert dimension keys to database column names
  const dbColumns = dimensionsToDbColumns(dimensions)

  // Setting Tier 2 dimensions automatically qualifies the repreneur
  const { error } = await supabase
    .from("repreneurs")
    .update({
      ...dbColumns,
      tier2_overall: overall,
      tier2_rated_at: new Date().toISOString(),
      tier2_rated_by: user?.id || null,
      // Also update legacy tier2_stars for backwards compatibility
      tier2_stars: overall ? Math.round(overall) : null,
      lifecycle_status: "qualified",
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Toggle a Tier 3 milestone checkbox
 * The database trigger will auto-update tier3_milestone_count and journey_stage
 */
export async function toggleMilestone(id: string, milestoneKey: MilestoneKey, value: boolean) {
  const supabase = await createServerClient()

  // Convert milestone key to database column name (ms_xxx)
  const columnName = `ms_${milestoneKey}`

  const { error } = await supabase
    .from("repreneurs")
    .update({ [columnName]: value })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/journey")
}
