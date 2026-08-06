"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

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
  await requireStaffAccess()
  const supabase = createAdminClient()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 14)

  const { data: repreneurs, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, journey_stage, updated_at")
    .is("rejected_at", null)
    .not("journey_stage", "in", '("archived","rejected")')
    .order("updated_at", { ascending: true })

  if (error) {
    console.error("Follow-up suggestions could not be loaded")
    return { suggestions: [], totalCount: 0 }
  }

  const suggestions = []
  for (const repreneur of repreneurs ?? []) {
    const [notesResult, activitiesResult] = await Promise.all([
      supabase
        .from("notes")
        .select("created_at")
        .eq("repreneur_id", repreneur.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("activities")
        .select("created_at")
        .eq("repreneur_id", repreneur.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ])

    const dates = [
      notesResult.data?.[0]?.created_at,
      activitiesResult.data?.[0]?.created_at,
      repreneur.updated_at,
    ]
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

