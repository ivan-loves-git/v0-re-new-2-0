"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Repreneur_Insert, LifecycleStatus } from "@/lib/types/repreneur"

export async function createRepreneur(formData: FormData) {
  const supabase = await createServerClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // Parse sector preferences
  const sectorPrefsRaw = formData.get("sector_preferences") as string
  const sector_preferences = sectorPrefsRaw
    ? sectorPrefsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const repreneur: Repreneur_Insert = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
    company_background: (formData.get("company_background") as string) || undefined,
    investment_capacity: (formData.get("investment_capacity") as string) || undefined,
    sector_preferences: sector_preferences.length > 0 ? sector_preferences : undefined,
    target_location: (formData.get("target_location") as string) || undefined,
    target_acquisition_size: (formData.get("target_acquisition_size") as string) || undefined,
    lifecycle_status: (formData.get("lifecycle_status") as LifecycleStatus) || "lead",
    source: (formData.get("source") as string) || undefined,
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

  // Parse sector preferences
  const sectorPrefsRaw = formData.get("sector_preferences") as string
  const sector_preferences = sectorPrefsRaw
    ? sectorPrefsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  const updates = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || null,
    company_background: (formData.get("company_background") as string) || null,
    investment_capacity: (formData.get("investment_capacity") as string) || null,
    sector_preferences: sector_preferences.length > 0 ? sector_preferences : null,
    target_location: (formData.get("target_location") as string) || null,
    target_acquisition_size: (formData.get("target_acquisition_size") as string) || null,
    lifecycle_status: formData.get("lifecycle_status") as LifecycleStatus,
    source: (formData.get("source") as string) || null,
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
