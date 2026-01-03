"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Repreneur_Insert, LifecycleStatus } from "@/lib/types/repreneur"
import { calculateTier1Score, type Tier1ScoringInput } from "@/lib/utils/tier1-scoring"

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

  const { error } = await supabase.from("repreneurs").update({ [field]: value }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
  revalidatePath("/journey")
}

export async function createNote(repreneurId: string, content: string) {
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
 * Score is calculated ONCE and stored as a static snapshot
 */
export async function saveQuestionnaire(id: string, data: QuestionnaireInput) {
  const supabase = await createServerClient()

  // Calculate the Tier 1 score
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

  const scoreBreakdown = calculateTier1Score(scoringInput)

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
