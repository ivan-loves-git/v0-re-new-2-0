"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { queueWaveServerEvent } from "@/lib/telemetry/server"

export interface WaveAiCustomTemplate {
  id: string
  name: string
  description: string
}

interface FollowUpSuggestionRow {
  id: string
  first_name: string
  last_name: string
  email: string
  journey_stage: string | null
  days_since_contact: number
  total_count: number
}

export async function getWaveAiCustomTemplates(): Promise<WaveAiCustomTemplate[]> {
  await requireStaffAccess()
  const { data, error } = await createAdminClient()
    .from("wavy_templates")
    .select("id, name, description")
    .eq("channel", "email")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("WAVE AI custom templates could not be loaded")
    return []
  }
  return (data ?? []) as WaveAiCustomTemplate[]
}

export async function getFollowUpSuggestions(): Promise<{
  suggestions: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    journeyStage: string | null
    daysSinceContact: number
  }>
  totalCount: number
}> {
  const access = await requireStaffAccess()
  const supabase = createAdminClient()
  const now = new Date()
  const { data, error } = await supabase.rpc("get_follow_up_suggestions", {
    p_now: now.toISOString(),
  })

  if (error || !data?.length) {
    if (error) {
      queueWaveServerEvent({
        distinctId: access.user.id,
        event: "wave_action_failed",
        properties: {
          surface: "staff", role: "staff", workflow: "repreneur_management",
          action: "render", outcome: "failure", error_code: "unavailable",
        },
      })
      console.error("Follow-up suggestions could not be loaded")
    }
    return { suggestions: [], totalCount: 0 }
  }

  const rows = data as FollowUpSuggestionRow[]
  return {
    suggestions: rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      journeyStage: row.journey_stage,
      daysSinceContact: row.days_since_contact,
    })),
    totalCount: Number(rows[0].total_count),
  }
}
