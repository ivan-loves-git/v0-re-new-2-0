"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import type { ActivityType, Activity_Insert } from "@/lib/types/repreneur"

export async function createActivity(
  repreneurId: string,
  activityType: ActivityType,
  notes?: string,
  durationMinutes?: number,
  eventDate?: string
) {
  const supabase = createAdminClient()

  // Get current user from Better Auth
  const user = await requireUser()

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

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function getActivities(repreneurId: string) {
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
  const supabase = createAdminClient()

  const { error } = await supabase.from("activities").delete().eq("id", activityId)

  if (error) {
    throw new Error(`Failed to delete activity: ${error.message}`)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}
