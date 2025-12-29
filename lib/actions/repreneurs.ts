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

  // Delete related records first (notes, repreneur_offers)
  await supabase.from("notes").delete().eq("repreneur_id", id)
  await supabase.from("repreneur_offers").delete().eq("repreneur_id", id)

  // Delete the repreneur
  const { error } = await supabase.from("repreneurs").delete().eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/repreneurs")
  redirect("/repreneurs")
}
