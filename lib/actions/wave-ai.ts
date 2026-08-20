"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { queueWaveServerEvent } from "@/lib/telemetry/server"

export interface WaveAiCustomTemplate {
  id: string
  name: string
  description: string
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
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 14)

  const { data: repreneurs, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, journey_stage, updated_at")
    .is("rejected_at", null)
    .not("journey_stage", "in", '("archived","rejected")')
    .order("updated_at", { ascending: true })

  if (error || !repreneurs?.length) {
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

  const repreneurIds = repreneurs.map((repreneur) => repreneur.id)
  const [notesResult, activitiesResult] = await Promise.all([
    supabase.from("notes").select("repreneur_id, created_at")
      .in("repreneur_id", repreneurIds).order("created_at", { ascending: false }),
    supabase.from("activities").select("repreneur_id, created_at")
      .in("repreneur_id", repreneurIds).order("created_at", { ascending: false }),
  ])

  if (notesResult.error || activitiesResult.error) {
    queueWaveServerEvent({
      distinctId: access.user.id,
      event: "wave_action_failed",
      properties: {
        surface: "staff", role: "staff", workflow: "repreneur_management",
        action: "render", outcome: "failure", error_code: "unavailable",
      },
    })
    console.error("Follow-up suggestions could not be loaded")
    return { suggestions: [], totalCount: 0 }
  }

  const lastContactByRepreneur = new Map<string, string>()
  for (const record of [...(notesResult.data ?? []), ...(activitiesResult.data ?? [])]) {
    if (!record.repreneur_id || !record.created_at) continue
    const previous = lastContactByRepreneur.get(record.repreneur_id)
    if (!previous || new Date(record.created_at).getTime() > new Date(previous).getTime()) {
      lastContactByRepreneur.set(record.repreneur_id, record.created_at)
    }
  }

  const suggestions = []
  for (const repreneur of repreneurs) {
    const dates = [lastContactByRepreneur.get(repreneur.id), repreneur.updated_at]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .sort((a, b) => b.getTime() - a.getTime())
    const lastContact = dates[0]
    if (!lastContact || lastContact >= cutoffDate) continue

    suggestions.push({
      id: repreneur.id,
      firstName: repreneur.first_name,
      lastName: repreneur.last_name,
      email: repreneur.email,
      journeyStage: repreneur.journey_stage,
      daysSinceContact: Math.floor((Date.now() - lastContact.getTime()) / 86_400_000),
    })
  }

  suggestions.sort((a, b) => b.daysSinceContact - a.daysSinceContact)
  return { suggestions: suggestions.slice(0, 10), totalCount: suggestions.length }
}
