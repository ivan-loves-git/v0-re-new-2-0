"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { Offer_Insert, OfferStatus, MilestoneType } from "@/lib/types/offer"

export async function createOffer(formData: FormData) {
  const supabase = await createServerClient()

  const offer: Offer_Insert = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    price: parseFloat(formData.get("price") as string),
    duration_days: parseInt(formData.get("duration_days") as string),
    acceptance_deadline_days: formData.get("acceptance_deadline_days")
      ? parseInt(formData.get("acceptance_deadline_days") as string)
      : 14, // Default 14 days to accept
    includes_hours: formData.get("includes_hours")
      ? parseInt(formData.get("includes_hours") as string)
      : 0,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") !== "false",
  }

  const { error } = await supabase.from("offers").insert(offer)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
  redirect("/offers")
}

export async function updateOffer(id: string, formData: FormData) {
  const supabase = await createServerClient()

  const updates = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    price: parseFloat(formData.get("price") as string),
    duration_days: parseInt(formData.get("duration_days") as string),
    acceptance_deadline_days: formData.get("acceptance_deadline_days")
      ? parseInt(formData.get("acceptance_deadline_days") as string)
      : null,
    includes_hours: formData.get("includes_hours")
      ? parseInt(formData.get("includes_hours") as string)
      : null,
    includes_resources: formData.get("includes_resources") === "true",
    is_active: formData.get("is_active") === "true",
  }

  const { error } = await supabase.from("offers").update(updates).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
}

export async function toggleOfferActive(id: string, isActive: boolean) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("offers").update({ is_active: isActive }).eq("id", id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/offers")
}

export async function assignOfferToRepreneur(repreneurId: string, offerId: string) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // Insert the offer assignment
  const { error: offerError } = await supabase.from("repreneur_offers").insert({
    repreneur_id: repreneurId,
    offer_id: offerId,
    status: "offered",
    offered_at: new Date().toISOString(),
    created_by: user.id,
  })

  if (offerError) {
    throw new Error(offerError.message)
  }

  // Auto-set lifecycle_status to "client" when an offer is assigned
  // This is part of the action-driven status system
  const { error: statusError } = await supabase
    .from("repreneurs")
    .update({ lifecycle_status: "client" })
    .eq("id", repreneurId)

  if (statusError) {
    throw new Error(statusError.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
  revalidatePath("/repreneurs")
  revalidatePath("/pipeline")
}

export async function updateRepreneurOfferStatus(repreneurOfferId: string, newStatus: OfferStatus, repreneurId: string) {
  const supabase = await createServerClient()

  const updates: Record<string, unknown> = { status: newStatus }

  if (newStatus === "accepted" || newStatus === "active") {
    const { data: repreneurOffer } = await supabase
      .from("repreneur_offers")
      .select("*, offer:offers(*)")
      .eq("id", repreneurOfferId)
      .single()

    if (repreneurOffer?.offer) {
      const now = new Date()
      updates.accepted_at = now.toISOString()

      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + repreneurOffer.offer.duration_days)
      updates.expires_at = expiresAt.toISOString()

      if (newStatus === "accepted") {
        updates.status = "active"
      }
    }
  }

  const { error } = await supabase.from("repreneur_offers").update(updates).eq("id", repreneurOfferId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
}

export async function deleteRepreneurOffer(repreneurOfferId: string, repreneurId: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("repreneur_offers").delete().eq("id", repreneurOfferId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidatePath("/offers")
}

// === Milestone Actions ===

export async function createMilestone(
  repreneurOfferId: string,
  repreneurId: string,
  milestoneType: MilestoneType,
  title: string,
  notes?: string,
  dueDate?: string
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const { error } = await supabase.from("offer_milestones").insert({
    repreneur_offer_id: repreneurOfferId,
    milestone_type: milestoneType,
    title,
    notes: notes || null,
    due_date: dueDate || null,
    created_by: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function toggleMilestoneComplete(
  milestoneId: string,
  repreneurId: string,
  isCompleted: boolean
) {
  const supabase = await createServerClient()

  const updates: Record<string, unknown> = {
    is_completed: isCompleted,
  }

  if (isCompleted) {
    updates.completed_at = new Date().toISOString()
  } else {
    updates.completed_at = null
  }

  const { error } = await supabase
    .from("offer_milestones")
    .update(updates)
    .eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function updateMilestone(
  milestoneId: string,
  repreneurId: string,
  title: string,
  notes?: string,
  dueDate?: string
) {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from("offer_milestones")
    .update({
      title,
      notes: notes || null,
      due_date: dueDate || null,
    })
    .eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function deleteMilestone(milestoneId: string, repreneurId: string) {
  const supabase = await createServerClient()

  const { error } = await supabase.from("offer_milestones").delete().eq("id", milestoneId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}
