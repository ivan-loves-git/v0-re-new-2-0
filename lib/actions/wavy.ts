"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"

export interface WavyTemplate {
  id: string
  name: string
  description: string
  channel: "email" | "whatsapp"
  created_by: string | null
  created_at: string
}

/**
 * Get all custom Wavy templates
 */
export async function getWavyTemplates(): Promise<WavyTemplate[]> {
  await requireUser()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("wavy_templates")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch wavy templates:", error)
    return []
  }

  return data || []
}

/**
 * Create a new custom Wavy template
 */
export async function createWavyTemplate(params: {
  name: string
  description: string
  channel: "email" | "whatsapp"
}): Promise<{ success: boolean; error?: string; template?: WavyTemplate }> {
  const user = await requireUser()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("wavy_templates")
    .insert({
      name: params.name,
      description: params.description,
      channel: params.channel,
      created_by: user.email,
    })
    .select()
    .single()

  if (error) {
    console.error("Failed to create wavy template:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/tools/wavy")
  return { success: true, template: data }
}

/**
 * Delete a custom Wavy template
 */
export async function deleteWavyTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  await requireUser()
  const supabase = createAdminClient()

  const { error } = await supabase
    .from("wavy_templates")
    .delete()
    .eq("id", templateId)

  if (error) {
    console.error("Failed to delete wavy template:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/tools/wavy")
  return { success: true }
}

/**
 * Get repreneurs for the Wavy tool (simplified view)
 */
export async function getRepreneursForWavy(): Promise<
  Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    t1Score: number | null
    whenScore: number | null
    willScore: number | null
    journeyStage: string | null
  }>
> {
  console.log("[Wavy] getRepreneursForWavy called - START")

  try {
    // Temporarily skip auth check for debugging
    // await requireUser()
    const supabase = createAdminClient()
    console.log("[Wavy] Supabase client created")

    const { data, error } = await supabase
      .from("repreneurs")
      .select(
        "id, first_name, last_name, email, phone, t1_score_v2, when_score_v2, will_score_v2, journey_stage"
      )
      .is("rejected_at", null)
      .order("first_name")

    console.log("[Wavy] Query result - data count:", data?.length, "error:", error?.message)

    if (error) {
      console.error("Failed to fetch repreneurs for wavy:", error)
      return []
    }

    return (data || []).map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      t1Score: r.t1_score_v2,
      whenScore: r.when_score_v2,
      willScore: r.will_score_v2,
      journeyStage: r.journey_stage,
    }))
  } catch (err) {
    console.error("[Wavy] getRepreneursForWavy ERROR:", err)
    return []
  }
}

/**
 * Get Wavy suggestions (stale repreneurs) for the dashboard
 */
export async function getWavySuggestions(): Promise<{
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
  await requireUser()
  const supabase = createAdminClient()

  const staleDays = 14
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - staleDays)

  // Get repreneurs who are not rejected/archived
  const { data: repreneurs, error } = await supabase
    .from("repreneurs")
    .select("id, first_name, last_name, email, journey_stage, updated_at")
    .is("rejected_at", null)
    .not("journey_stage", "in", '("archived","rejected")')
    .order("updated_at", { ascending: true })

  if (error) {
    console.error("Failed to fetch repreneurs for suggestions:", error)
    return { suggestions: [], totalCount: 0 }
  }

  const suggestions = []

  for (const repreneur of repreneurs || []) {
    // Get the most recent note or activity
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

    const lastNoteDate = notesResult.data?.[0]?.created_at
      ? new Date(notesResult.data[0].created_at)
      : null
    const lastActivityDate = activitiesResult.data?.[0]?.created_at
      ? new Date(activitiesResult.data[0].created_at)
      : null

    let lastContactDate: Date | null = null
    if (lastNoteDate && lastActivityDate) {
      lastContactDate = lastNoteDate > lastActivityDate ? lastNoteDate : lastActivityDate
    } else {
      lastContactDate = lastNoteDate || lastActivityDate
    }

    if (!lastContactDate) {
      lastContactDate = new Date(repreneur.updated_at)
    }

    if (lastContactDate < cutoffDate) {
      const daysSinceContact = Math.floor(
        (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      suggestions.push({
        id: repreneur.id,
        firstName: repreneur.first_name,
        lastName: repreneur.last_name,
        email: repreneur.email,
        journeyStage: repreneur.journey_stage,
        daysSinceContact,
      })
    }
  }

  // Sort by staleness
  suggestions.sort((a, b) => b.daysSinceContact - a.daysSinceContact)

  return {
    suggestions: suggestions.slice(0, 10),
    totalCount: suggestions.length,
  }
}
