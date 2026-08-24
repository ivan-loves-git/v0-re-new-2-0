"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaffAccess } from "@/lib/access-control"
import { revalidatePath } from "next/cache"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"
import type { ActivityType, Activity_Insert } from "@/lib/types/repreneur"
import { updateRepreneurOfferStatus } from "./offers"

export async function createActivity(
  repreneurId: string,
  activityType: ActivityType,
  notes?: string,
  durationMinutes?: number,
  eventDate?: string
) {
  const { user } = await requireStaffAccess()
  const supabase = createAdminClient()

  const activity: Activity_Insert = {
    repreneur_id: repreneurId,
    activity_type: activityType,
    notes: notes || undefined,
    duration_minutes: durationMinutes || undefined,
    event_date: eventDate || undefined,
    created_by: user.id,
  }

  const { error } = await supabase.from("activities").insert(activity)

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`)
  }

  // Activity-driven lifecycle transitions.
  // offer_approved  → offer.status = accepted, repreneur.lifecycle_status = client
  // offer_rejected  → offer.status = declined, repreneur.lifecycle_status = declined
  if (activityType === "offer_approved" || activityType === "offer_rejected") {
    const { data: pendingOffer } = await supabase
      .from("repreneur_offers")
      .select("id")
      .eq("repreneur_id", repreneurId)
      .eq("status", "offered")
      .order("offered_at", { ascending: false })
      .limit(1)
      .single()

    if (activityType === "offer_approved") {
      if (pendingOffer) {
        await updateRepreneurOfferStatus(pendingOffer.id, "accepted", repreneurId)
      }
      await supabase
        .from("repreneurs")
        .update({ lifecycle_status: "client" })
        .eq("id", repreneurId)
    } else {
      if (pendingOffer) {
        await updateRepreneurOfferStatus(pendingOffer.id, "declined", repreneurId)
      }
      await supabase
        .from("repreneurs")
        .update({ lifecycle_status: "declined", declined_at: new Date().toISOString() })
        .eq("id", repreneurId)
    }
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidateRepreneurDashboardTags()
}

export async function getActivities(repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { data: activities, error } = await supabase
    .from("activities")
    .select(`
      *,
      created_by_email:auth.users!activities_created_by_fkey(email)
    `)
    .eq("repreneur_id", repreneurId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  // Transform to include email
  return (activities || []).map((activity: any) => ({
    ...activity,
    created_by_email: activity.created_by_email?.email || "Unknown",
  }))
}

export async function deleteActivity(activityId: string, repreneurId: string) {
  await requireStaffAccess()
  const supabase = createAdminClient()

  const { error } = await supabase.from("activities").delete().eq("id", activityId)

  if (error) {
    throw new Error(`Failed to delete activity: ${error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
  revalidateRepreneurDashboardTags()
}
