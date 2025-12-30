"use server"

import { createServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActivityType, Activity_Insert } from "@/lib/types/repreneur"

export async function createActivity(
  repreneurId: string,
  activityType: ActivityType,
  notes?: string,
  durationMinutes?: number
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  const activity: Activity_Insert = {
    repreneur_id: repreneurId,
    activity_type: activityType,
    notes: notes || undefined,
    duration_minutes: durationMinutes || undefined,
    created_by: user.id,
  }

  const { error } = await supabase.from("activities").insert(activity)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}

export async function getActivities(repreneurId: string) {
  const supabase = await createServerClient()

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
  const supabase = await createServerClient()

  const { error } = await supabase.from("activities").delete().eq("id", activityId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/repreneurs/${repreneurId}`)
}
