import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth-server"

/**
 * GET /api/wavy/repreneurs
 * Returns list of non-rejected repreneurs for the Wavy tool
 */
export async function GET() {
  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("repreneurs")
      .select("id, first_name, last_name, email, phone, t1_score_v2, when_score_v2, will_score_v2, journey_stage")
      .is("rejected_at", null)
      .order("first_name")

    if (error) {
      console.error("Error fetching repreneurs:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      repreneurs: (data || []).map(r => ({
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
    })
  } catch (err) {
    console.error("Error in wavy repreneurs API:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch repreneurs" },
      { status: 500 }
    )
  }
}
