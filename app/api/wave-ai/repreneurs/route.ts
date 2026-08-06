import { NextResponse } from "next/server"
import { getCurrentUserAccessFromHeaders } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  const access = await getCurrentUserAccessFromHeaders(request.headers)
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (access.role !== "staff") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await createAdminClient()
    .from("repreneurs")
    .select("id, first_name, last_name, email, journey_stage, who_score, when_score, tier1_score")
    .is("rejected_at", null)
    .order("last_name")
    .limit(200)

  if (error) {
    console.error("WAVE AI recipient projection could not be loaded")
    return NextResponse.json({ error: "Failed to load recipients." }, { status: 500 })
  }

  return NextResponse.json({
    repreneurs: (data ?? []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      journeyStage: row.journey_stage,
      whoScore: row.who_score ?? row.tier1_score,
      whenScore: row.when_score,
    })),
  })
}
