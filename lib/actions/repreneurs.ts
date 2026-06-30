"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth-server"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Repreneur_Insert, LifecycleStatus, PersonaType, Tier2Dimensions, MilestoneKey } from "@/lib/types/repreneur"
import { calculateTier2Overall, dimensionsToDbColumns } from "@/lib/utils/tier2-scoring"
import { milestonesToDbColumns, countMilestones, extractMilestones, deriveJourneyStage } from "@/lib/utils/journey-derivation"
import { calculateTier1Score, type Tier1ScoringInput } from "@/lib/utils/tier1-scoring"
import { calculateDualScore } from "@/lib/utils/scoring-v2"
import type { WhoAnswers, WhenAnswers } from "@/lib/types/scoring-v2"
import { getTier1ScoringCriteria } from "@/lib/data/evaluation-criteria"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import { sendEmail } from "@/lib/email"
import { RejectionEmail } from "@/lib/email/templates/rejection"

/**
 * Create a new repreneur from the admin form.
 *
 * Field categories:
 * - Basic fields (admin form): name, email, phone, linkedin, status, source, persona, company_background, consent
 * - Questionnaire fields (v2 intake): q05-q16, who_score, when_score, recommendation, scoring_flags
 * - Legacy fields (preserved for existing data): investment_capacity, sector_preferences, target_location, target_acquisition_size
 *
 * Note: The admin form no longer collects legacy Tier 1 scoring fields.
 * These fields are now populated via the v2 questionnaire (q05-q16) intake form.
 * The action still accepts these fields for backwards compatibility with imports.
 */
export async function createRepreneur(formData: FormData) {
  const supabase = createAdminClient()

  // Get current user from Better Auth
  const user = await requireUser()

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

  // Parse target location (now sent as JSON array)
  const targetLocationRaw = formData.get("target_location") as string
  let target_location: string[] = []
  if (targetLocationRaw) {
    try {
      target_location = JSON.parse(targetLocationRaw)
    } catch {
      // Fallback to single value for backwards compatibility
      target_location = [targetLocationRaw]
    }
  }

  // Parse marketing consent checkbox
  const marketingConsent = formData.get("marketing_consent") === "on"

  // Validate required fields
  const email = (formData.get("email") as string || "").toLowerCase().trim()
  const first_name = (formData.get("first_name") as string || "").trim()
  const last_name = (formData.get("last_name") as string || "").trim()

  if (!first_name) throw new Error("First name is required")
  if (!last_name) throw new Error("Last name is required")
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Valid email is required")

  const repreneur: Repreneur_Insert = {
    email,
    first_name,
    last_name,
    phone: (formData.get("phone") as string) || undefined,
    linkedin_url: (formData.get("linkedin_url") as string) || undefined,
    company_background: (formData.get("company_background") as string) || undefined,
    investment_capacity: (formData.get("investment_capacity") as string) || undefined,
    sector_preferences: sector_preferences.length > 0 ? sector_preferences : undefined,
    target_location: target_location.length > 0 ? target_location : undefined,
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
  revalidateRepreneurDashboardTags()
  redirect(`/repreneurs/${data.id}`)
}

/**
 * Update a repreneur from the admin form.
 *
 * Field categories:
 * - Basic fields (admin form): name, email, phone, linkedin, status, source, persona, company_background, consent
 * - Questionnaire fields (v2 intake): q05-q16, who_score, when_score, recommendation, scoring_flags
 * - Legacy fields (preserved for existing data): investment_capacity, sector_preferences, target_location, target_acquisition_size
 *
 * Note: Legacy Tier 1 fields (investment_capacity, sector_preferences, target_location, target_acquisition_size)
 * are still handled by this action for backwards compatibility with existing data. However, the admin form
 * no longer collects these fields - they come from the v2 questionnaire or historical imports.
 */
export async function updateRepreneur(id: string, formData: FormData) {
  const supabase = createAdminClient()

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

  // Parse target location (now sent as JSON array)
  const targetLocationRaw = formData.get("target_location") as string
  let target_location: string[] = []
  if (targetLocationRaw) {
    try {
      target_location = JSON.parse(targetLocationRaw)
    } catch {
      // Fallback to single value for backwards compatibility
      target_location = [targetLocationRaw]
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
    target_location: target_location.length > 0 ? target_location : null,
    target_acquisition_size: (formData.get("target_acquisition_size") as string) || null,
    // lifecycle_status intentionally excluded — profile edits must never overwrite
    // status set by dedicated actions (assignOffer, pipeline drag, setTier2, etc.)
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
  revalidateRepreneurDashboardTags()
}

export async function updateRepreneurStatus(id: string, status: LifecycleStatus) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("repreneurs").update({ lifecycle_status: status }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
  revalidateRepreneurDashboardTags()
}

export async function updateRepreneurJourneyStage(id: string, stage: string | null) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("repreneurs").update({ journey_stage: stage }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/journey")
  revalidateRepreneurDashboardTags()
}

const ALLOWED_REPRENEUR_FIELD_UPDATES = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "sector_preferences",
  "cv_url",
  "ldc_url",
])

export async function updateRepreneurField(id: string, field: string, value: string | string[] | null) {
  await requireStaffAccess()
  if (!ALLOWED_REPRENEUR_FIELD_UPDATES.has(field)) {
    throw new Error("Field is not editable from this action")
  }

  const supabase = createAdminClient()

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
    revalidateRepreneurDashboardTags()
    console.log(`[updateRepreneurField] Revalidation complete`)
  } catch (revalidateError) {
    console.error(`[updateRepreneurField] Revalidation error:`, revalidateError)
    // Don't throw - the update succeeded, revalidation is secondary
  }
}

export async function createNote(repreneurId: string, content: string, noteType: string = "other") {
  const supabase = createAdminClient()

  // Get current user from Better Auth
  const user = await requireUser()

  const { error } = await supabase.from("notes").insert({
    repreneur_id: repreneurId,
    content,
    note_type: noteType,
    created_by: user.id,
  })

  if (error) {
    throw new Error(`Failed to create note: ${error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteNote(noteId: string, repreneurId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase.from("notes").delete().eq("id", noteId)

  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteRepreneur(id: string) {
  const supabase = createAdminClient()

  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("email")
    .eq("id", id)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Database cascades handle related data automatically (notes, activities, offers, etc.)
  // Foreign keys are set up with ON DELETE CASCADE
  const { error } = await supabase.from("repreneurs").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  const email = typeof repreneur?.email === "string" ? repreneur.email.trim().toLowerCase() : null
  if (email) {
    const { data: authUsers, error: authUserError } = await supabase
      .from("user")
      .select("id")
      .eq("email", email)

    if (authUserError) {
      throw new Error(authUserError.message)
    }

    const userIds = (authUsers ?? [])
      .map((user) => user.id)
      .filter((userId): userId is string => typeof userId === "string" && userId.length > 0)

    const { error: roleByEmailError } = await supabase
      .from("app_user_roles")
      .delete()
      .eq("email", email)
      .eq("role", "repreneur")

    if (roleByEmailError && roleByEmailError.code !== "42P01") {
      throw new Error(roleByEmailError.message)
    }

    const { error: roleByRepreneurError } = await supabase
      .from("app_user_roles")
      .delete()
      .eq("repreneur_id", id)
      .eq("role", "repreneur")

    if (roleByRepreneurError && roleByRepreneurError.code !== "42P01" && roleByRepreneurError.code !== "42703") {
      throw new Error(roleByRepreneurError.message)
    }

    if (userIds.length > 0) {
      const { error: roleByUserError } = await supabase
        .from("app_user_roles")
        .delete()
        .in("user_id", userIds)
        .eq("role", "repreneur")

      if (roleByUserError && roleByUserError.code !== "42P01") {
        throw new Error(roleByUserError.message)
      }

      const { error: sessionError } = await supabase
        .from("session")
        .delete()
        .in("userId", userIds)

      if (sessionError) {
        throw new Error(sessionError.message)
      }
    }
  }

  revalidatePath("/repreneurs")
  revalidatePath("/portal/deals")
  revalidatePath("/portal/profile")
  redirect("/repreneurs")
}

/**
 * Set Tier 2 star rating (1-5) for a repreneur
 * Only upgrades lead → qualified; won't downgrade client → qualified
 */
export async function setTier2Stars(id: string, stars: number) {
  const supabase = createAdminClient()

  if (stars < 1 || stars > 5) {
    throw new Error("Star rating must be between 1 and 5")
  }

  // Only upgrade lead → qualified, never downgrade client → qualified
  const { data: current } = await supabase
    .from("repreneurs")
    .select("lifecycle_status")
    .eq("id", id)
    .single()

  const shouldQualify = current?.lifecycle_status === "lead"

  const updates: Record<string, unknown> = { tier2_stars: stars }
  if (shouldQualify) {
    updates.lifecycle_status = "qualified"
  }

  const { error } = await supabase
    .from("repreneurs")
    .update(updates)
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
  const supabase = createAdminClient()

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
  const supabase = createAdminClient()

  // Fetch status + email fields in one query (avoids N+1)
  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("lifecycle_status, first_name, last_name, email")
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
  sendEmail({
    to: repreneur.email,
    subject: "Mise à jour concernant votre candidature Re-New",
    repreneurId: id,
    templateKey: "rejection",
    react: RejectionEmail({
      repreneur: {
        id,
        firstName: repreneur.first_name,
        lastName: repreneur.last_name,
        email: repreneur.email,
      },
    }),
  }).catch((err) => {
    console.error("Failed to send rejection email:", err)
  })

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Un-reject a repreneur (restore to previous status)
 */
export async function unrejectRepreneur(id: string) {
  const supabase = createAdminClient()

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
 * Decline a repreneur (internal decision, no email sent)
 * Different from reject: decline is a manual admin choice, reject sends rejection email
 */
export async function declineRepreneur(id: string, reasonCategory?: string, reasonText?: string) {
  const supabase = createAdminClient()

  // First, get the current status to store as previous_status
  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("lifecycle_status")
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Don't decline if already declined or rejected
  if (repreneur.lifecycle_status === "declined") {
    throw new Error("Repreneur is already declined")
  }
  if (repreneur.lifecycle_status === "rejected") {
    throw new Error("Repreneur is already rejected")
  }

  const { error } = await supabase
    .from("repreneurs")
    .update({
      lifecycle_status: "declined",
      previous_status: repreneur.lifecycle_status,
      declined_at: new Date().toISOString(),
      decline_reason_category: reasonCategory || null,
      decline_reason_text: reasonText || null,
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  // No email sent for decline (internal decision)

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
}

/**
 * Restore a declined repreneur to their previous status
 */
export async function undeclineRepreneur(id: string) {
  const supabase = createAdminClient()

  // Get the previous status
  const { data: repreneur, error: fetchError } = await supabase
    .from("repreneurs")
    .select("lifecycle_status, previous_status")
    .eq("id", id)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  // Can only un-decline if currently declined
  if (repreneur.lifecycle_status !== "declined") {
    throw new Error("Repreneur is not declined")
  }

  // Restore to previous status, or default to "lead" if no previous status
  const restoredStatus = repreneur.previous_status || "lead"

  const { error } = await supabase
    .from("repreneurs")
    .update({
      lifecycle_status: restoredStatus,
      previous_status: null,
      declined_at: null,
      decline_reason_category: null,
      decline_reason_text: null,
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
 * Fetch enrichment data for CSV export (interview counts, offer info, event dates).
 *
 * Event dates are formatted YYYY-MM-DD so spreadsheets parse them as dates, not strings.
 * "1st" and "2nd" offer are ordered chronologically by offered_at — there is no
 * explicit sequence column on repreneur_offers.
 */
export async function getExportEnrichmentData(): Promise<{
  interviewCounts: Record<string, number>
  interviewBooked: Record<string, boolean>
  firstInterviewAt: Record<string, string>
  firstContactAt: Record<string, string>
  offerData: Record<string, { names: string; status: string }>
  firstOffer: Record<string, { offeredAt: string; status: string; acceptedAt: string; declinedAt: string }>
  secondOffer: Record<string, { offeredAt: string; status: string; acceptedAt: string; declinedAt: string }>
}> {
  const supabase = createAdminClient()
  const nowIso = new Date().toISOString()
  const toDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "")

  // Pull all activities once. Used for three things:
  //   - first_contact_at  = MIN(activities.created_at) per repreneur (any activity_type)
  //   - first_interview_at = earliest interview activity (event_date if set, else created_at)
  //   - interview_count + interview_booked
  // first_contact_at is Bertrand's KPI anchor for "Application → 1st Contact" lag.
  // We use any logged activity rather than the welcome email specifically, because
  // (a) email_logs has no welcome rows in production today, and (b) any activity row
  // = the team did something with this lead, which is the operational definition of contact.
  const { data: activities } = await supabase
    .from("activities")
    .select("repreneur_id, activity_type, event_date, created_at")

  const interviewCounts: Record<string, number> = {}
  const interviewBooked: Record<string, boolean> = {}
  const firstInterviewIso: Record<string, string> = {}
  const firstActivityIso: Record<string, string> = {}
  for (const a of activities || []) {
    if (a.created_at) {
      const prevAny = firstActivityIso[a.repreneur_id]
      if (!prevAny || a.created_at < prevAny) firstActivityIso[a.repreneur_id] = a.created_at
    }
    if (a.activity_type === "interview") {
      interviewCounts[a.repreneur_id] = (interviewCounts[a.repreneur_id] || 0) + 1
      if (a.event_date && a.event_date >= nowIso) {
        interviewBooked[a.repreneur_id] = true
      }
      const when = a.event_date || a.created_at
      if (when) {
        const prev = firstInterviewIso[a.repreneur_id]
        if (!prev || when < prev) firstInterviewIso[a.repreneur_id] = when
      }
    }
  }
  const firstInterviewAt: Record<string, string> = {}
  for (const [id, iso] of Object.entries(firstInterviewIso)) {
    firstInterviewAt[id] = toDate(iso)
  }
  const firstContactAt: Record<string, string> = {}
  for (const [id, iso] of Object.entries(firstActivityIso)) {
    firstContactAt[id] = toDate(iso)
  }

  // Offer data by repreneur. Order ASC by offered_at so we can pick 1st / 2nd.
  const { data: offers } = await supabase
    .from("repreneur_offers")
    .select("repreneur_id, status, offered_at, accepted_at, declined_at, offer:offers(name)")
    .order("offered_at", { ascending: true })

  const offerData: Record<string, { names: string; status: string }> = {}
  const firstOffer: Record<string, { offeredAt: string; status: string; acceptedAt: string; declinedAt: string }> = {}
  const secondOffer: Record<string, { offeredAt: string; status: string; acceptedAt: string; declinedAt: string }> = {}
  const seenCount: Record<string, number> = {}
  for (const o of offers || []) {
    const offerRaw = o.offer as { name: string } | { name: string }[] | null
    const offerName = (Array.isArray(offerRaw) ? offerRaw[0]?.name : offerRaw?.name) || "Unknown"
    const existing = offerData[o.repreneur_id]
    if (existing) {
      existing.names += ` | ${offerName}`
      existing.status += ` | ${o.status}`
    } else {
      offerData[o.repreneur_id] = { names: offerName, status: o.status }
    }

    const idx = seenCount[o.repreneur_id] || 0
    const slot = {
      offeredAt: toDate(o.offered_at),
      status: o.status,
      acceptedAt: toDate(o.accepted_at),
      declinedAt: toDate((o as { declined_at?: string | null }).declined_at),
    }
    if (idx === 0) firstOffer[o.repreneur_id] = slot
    else if (idx === 1) secondOffer[o.repreneur_id] = slot
    seenCount[o.repreneur_id] = idx + 1
  }

  return { interviewCounts, interviewBooked, firstInterviewAt, firstContactAt, offerData, firstOffer, secondOffer }
}

/**
 * Save scoring accuracy rating (post-interview assessment)
 */
export async function saveAccuracyRating(
  repreneurId: string,
  whoAccuracy: string,
  whenAccuracy: string,
  notes?: string,
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("repreneurs")
    .update({
      who_accuracy: whoAccuracy,
      when_accuracy: whenAccuracy,
      accuracy_notes: notes || null,
      accuracy_rated_at: new Date().toISOString(),
      accuracy_rated_by: "team",
    })
    .eq("id", repreneurId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
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
  const supabase = createAdminClient()

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
  const supabase = createAdminClient()

  // First update the single field
  const { data: updateResult, error: updateError } = await supabase
    .from("repreneurs")
    .update({ [field]: value })
    .eq("id", id)
    .select()
    .single()

  if (!updateResult && !updateError) {
    throw new Error("Update failed: RLS policy may have blocked the operation")
  }

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
  const { data: scoreResult, error: scoreError } = await supabase
    .from("repreneurs")
    .update({
      tier1_score: scoreBreakdown.total,
      tier1_score_breakdown: scoreBreakdown,
    })
    .eq("id", id)
    .select()
    .single()

  if (!scoreResult && !scoreError) {
    throw new Error("Score update failed: RLS policy may have blocked the operation")
  }

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
  const supabase = createAdminClient()

  // Update all fields at once
  const { data: updateResult, error: updateError } = await supabase
    .from("repreneurs")
    .update(answers)
    .eq("id", id)
    .select()
    .single()

  if (!updateResult && !updateError) {
    throw new Error("Update failed: RLS policy may have blocked the operation")
  }

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
  const { data: scoreResult, error: scoreError } = await supabase
    .from("repreneurs")
    .update({
      tier1_score: scoreBreakdown.total,
      tier1_score_breakdown: scoreBreakdown,
    })
    .eq("id", id)
    .select()
    .single()

  if (!scoreResult && !scoreError) {
    throw new Error("Score update failed: RLS policy may have blocked the operation")
  }

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
 * Only upgrades lead → qualified; won't downgrade client → qualified
 */
export async function setTier2Dimensions(id: string, dimensions: Partial<Tier2Dimensions>) {
  const supabase = createAdminClient()

  // Calculate weighted overall score
  const overall = calculateTier2Overall(dimensions)

  // Convert dimension keys to database column names
  const dbColumns = dimensionsToDbColumns(dimensions)

  // Only upgrade lead → qualified, never downgrade client → qualified
  const { data: current } = await supabase
    .from("repreneurs")
    .select("lifecycle_status")
    .eq("id", id)
    .single()

  const shouldQualify = current?.lifecycle_status === "lead"

  const updates: Record<string, unknown> = {
    ...dbColumns,
    tier2_overall: overall,
    tier2_rated_at: new Date().toISOString(),
    tier2_stars: overall ? Math.round(overall) : null,
  }
  if (shouldQualify) {
    updates.lifecycle_status = "qualified"
  }

  const { error } = await supabase
    .from("repreneurs")
    .update(updates)
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  // Only revalidate the specific profile page (optimistic UI handles immediate feedback)
  revalidatePath(`/repreneurs/${id}`)
}

/**
 * Toggle a Tier 3 milestone checkbox
 * The database trigger will auto-update tier3_milestone_count and journey_stage
 */
export async function toggleMilestone(id: string, milestoneKey: MilestoneKey, value: boolean) {
  const supabase = createAdminClient()

  // Convert milestone key to database column name (ms_xxx)
  const columnName = `ms_${milestoneKey}`

  const { error } = await supabase
    .from("repreneurs")
    .update({ [columnName]: value })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  // Only revalidate the specific profile page (optimistic UI handles immediate feedback)
  revalidatePath(`/repreneurs/${id}`)
}

/**
 * Questionnaire V2 data input type (dual scoring)
 */
export interface QuestionnaireV2Input {
  // WHO (Q05-Q10)
  q05_status: string | null
  q06_experience: string | null
  q07_leadership: string | null
  q08_crisis: string | null
  q09_investment: string | null
  q10_impact: string | null
  // Q11 v3 priority choice (added 2026-04-23) — optional; null preserves v2 scoring for legacy records
  q11_priority_choice?: 'preferred' | 'one_among_others' | null
  // WHEN (Q11-Q16)
  q11_project_status: string[]
  q12_geo_zones: string[]
  q13_target_sectors_v2: string[]
  q14_deal_size: string[]
  q15_structure: string[]
  q16_equity: string | null
}

/**
 * Save questionnaire v2 data and calculate dual WHO/WHEN scores
 * This is the new dual scoring system replacing the legacy Tier 1 score
 */
export async function saveQuestionnaireV2(id: string, data: QuestionnaireV2Input) {
  const supabase = createAdminClient()

  // v3 penalties read q11_priority_choice + ldc_url. If the input doesn't include
  // priority_choice, fall back to the current DB value (profile-edit path may not
  // surface it). ldc_url is always read from DB since it's uploaded separately.
  const { data: existing } = await supabase
    .from("repreneurs")
    .select("q11_priority_choice, ldc_url")
    .eq("id", id)
    .maybeSingle()

  const priorityChoice: 'preferred' | 'one_among_others' | null =
    data.q11_priority_choice !== undefined
      ? (data.q11_priority_choice ?? null)
      : ((existing?.q11_priority_choice as 'preferred' | 'one_among_others' | null) ?? null)

  // Build WHO answers for scoring (use defaults for null values to prevent scoring errors)
  const whoAnswers: WhoAnswers = {
    q05: (data.q05_status || 'employee') as WhoAnswers['q05'],
    q06: (data.q06_experience || 'less_than_10') as WhoAnswers['q06'],
    q07: (data.q07_leadership || 'none') as WhoAnswers['q07'],
    q08: (data.q08_crisis || 'none') as WhoAnswers['q08'],
    q09: (data.q09_investment || 'none') as WhoAnswers['q09'],
    q10: (data.q10_impact || 'none') as WhoAnswers['q10'],
  }

  // Build WHEN answers for scoring (use defaults for null values)
  const whenAnswers: WhenAnswers = {
    q11: (data.q11_project_status || []) as WhenAnswers['q11'],
    q12: data.q12_geo_zones || [],
    q13: data.q13_target_sectors_v2 || [],
    q14: (data.q14_deal_size || []) as WhenAnswers['q14'],
    q15: (data.q15_structure || []) as WhenAnswers['q15'],
    q16: (data.q16_equity || 'tbd') as WhenAnswers['q16'],
    q11_priority: priorityChoice,
    hasFicheDeCadrage: Boolean(existing?.ldc_url),
  }

  // Calculate dual scores
  const dualScore = calculateDualScore(whoAnswers, whenAnswers)

  // Update the repreneur with v2 questionnaire data and scores
  const { error } = await supabase
    .from("repreneurs")
    .update({
      // WHO answers
      q05_status: data.q05_status,
      q06_experience: data.q06_experience,
      q07_leadership: data.q07_leadership,
      q08_crisis: data.q08_crisis,
      q09_investment: data.q09_investment,
      q10_impact: data.q10_impact,
      // Q11 v3 priority choice (only update if explicitly provided in input)
      ...(data.q11_priority_choice !== undefined
        ? { q11_priority_choice: data.q11_priority_choice }
        : {}),
      // WHEN answers
      q11_project_status: data.q11_project_status,
      q12_geo_zones: data.q12_geo_zones,
      q13_target_sectors_v2: data.q13_target_sectors_v2,
      q14_deal_size: data.q14_deal_size,
      q15_structure: data.q15_structure,
      q16_equity: data.q16_equity,
      // Dual scores
      who_score: dualScore.who.score,
      when_score: dualScore.when.score,
      who_score_breakdown: dualScore.who.breakdown,
      when_score_breakdown: dualScore.when.breakdown,
      scoring_flags: dualScore.flags.flags,
      recommendation: dualScore.recommendation,
      // Also update sector_preferences for backward compatibility
      sector_preferences: data.q13_target_sectors_v2,
      // Mark questionnaire as completed
      questionnaire_completed_at: new Date().toISOString(),
      // Clear needs_data_completion flag now that v2 data is saved
      needs_data_completion: false,
    })
    .eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  revalidatePath(`/repreneurs/${id}`)
  revalidatePath("/pipeline")
  revalidatePath("/dashboard_re")

  return dualScore
}
