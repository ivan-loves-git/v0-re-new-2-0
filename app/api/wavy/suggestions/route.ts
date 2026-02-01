import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-server"
import { createAdminClient } from "@/lib/supabase/admin"

const STALE_DAYS = 14 // Repreneurs with no activity in 14+ days

export async function GET() {
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS)

    // Get repreneurs who:
    // 1. Are not rejected
    // 2. Have no notes or activities in the last 14 days
    // 3. Are in an active journey stage (not archived)
    const { data: staleRepreneurs, error } = await supabase
      .from("repreneurs")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        journey_stage,
        t1_score_v2,
        when_score_v2,
        will_score_v2,
        updated_at
      `)
      .is("rejected_at", null)
      .not("journey_stage", "in", '("archived","rejected")')
      .order("updated_at", { ascending: true })

    if (error) {
      console.error("Error fetching repreneurs:", error)
      return NextResponse.json(
        { error: "Failed to fetch repreneurs" },
        { status: 500 }
      )
    }

    // For each repreneur, check their last activity
    const suggestions = []

    for (const repreneur of staleRepreneurs || []) {
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

      // Get the most recent of the two
      let lastContactDate: Date | null = null
      if (lastNoteDate && lastActivityDate) {
        lastContactDate = lastNoteDate > lastActivityDate ? lastNoteDate : lastActivityDate
      } else {
        lastContactDate = lastNoteDate || lastActivityDate
      }

      // If no contact ever, use the repreneur's creation/updated date
      if (!lastContactDate) {
        lastContactDate = new Date(repreneur.updated_at)
      }

      // Check if it's stale (more than STALE_DAYS ago)
      if (lastContactDate < cutoffDate) {
        const daysSinceContact = Math.floor(
          (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        suggestions.push({
          id: repreneur.id,
          firstName: repreneur.first_name,
          lastName: repreneur.last_name,
          email: repreneur.email,
          phone: repreneur.phone,
          journeyStage: repreneur.journey_stage,
          t1Score: repreneur.t1_score_v2,
          whenScore: repreneur.when_score_v2,
          willScore: repreneur.will_score_v2,
          lastContactDate: lastContactDate.toISOString(),
          daysSinceContact,
        })
      }
    }

    // Sort by days since contact (most stale first)
    suggestions.sort((a, b) => b.daysSinceContact - a.daysSinceContact)

    // Limit to top 10 for dashboard display
    return NextResponse.json({
      suggestions: suggestions.slice(0, 10),
      totalCount: suggestions.length,
      staleDays: STALE_DAYS,
    })
  } catch (error) {
    console.error("Error getting suggestions:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get suggestions" },
      { status: 500 }
    )
  }
}
