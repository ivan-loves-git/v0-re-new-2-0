import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Distribution: explorer (4), learner (3), ready (2), serial_acquirer (2)
const JOURNEY_STAGE_DISTRIBUTION: Record<string, string> = {
  "test.alice@example.com": "explorer",
  "test.bob@example.com": "learner",
  "test.charlie@example.com": "serial_acquirer",
  "test.diana@example.com": "explorer",
  "test.ethan@example.com": "learner",
  "test.fiona@example.com": "ready",
  "test.george@example.com": "learner",
  "test.hannah@example.com": "ready",
  "test.ivan@example.com": "serial_acquirer",
  "test.julia@example.com": "explorer",
  // For the 11th user if exists, we'll default to explorer
}

export async function POST() {
  const supabase = await createServerClient()

  // Get current user for authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    // Fetch all repreneurs
    const { data: repreneurs, error: fetchError } = await supabase
      .from("repreneurs")
      .select("id, email, first_name, last_name, journey_stage")
      .order("created_at", { ascending: true })

    if (fetchError) {
      return NextResponse.json({ error: `Fetch error: ${fetchError.message}` }, { status: 500 })
    }

    if (!repreneurs || repreneurs.length === 0) {
      return NextResponse.json({ error: "No repreneurs found" }, { status: 404 })
    }

    // Define stages for distribution if emails don't match the test data
    const stages = ["explorer", "explorer", "explorer", "explorer", "learner", "learner", "learner", "ready", "ready", "serial_acquirer", "serial_acquirer"]

    const updates = []

    for (let i = 0; i < repreneurs.length; i++) {
      const repreneur = repreneurs[i]

      // Try to get from predefined distribution, otherwise use index-based distribution
      const newStage = JOURNEY_STAGE_DISTRIBUTION[repreneur.email] || stages[i % stages.length]

      const { error: updateError } = await supabase
        .from("repreneurs")
        .update({ journey_stage: newStage })
        .eq("id", repreneur.id)

      if (updateError) {
        console.error(`Error updating ${repreneur.email}:`, updateError)
        updates.push({
          email: repreneur.email,
          name: `${repreneur.first_name} ${repreneur.last_name}`,
          old_stage: repreneur.journey_stage,
          new_stage: newStage,
          status: "failed",
          error: updateError.message
        })
      } else {
        updates.push({
          email: repreneur.email,
          name: `${repreneur.first_name} ${repreneur.last_name}`,
          old_stage: repreneur.journey_stage,
          new_stage: newStage,
          status: "success"
        })
      }
    }

    const successful = updates.filter(u => u.status === "success").length
    const failed = updates.filter(u => u.status === "failed").length

    // Get summary of new distribution
    const distribution = {
      explorer: updates.filter(u => u.new_stage === "explorer" && u.status === "success").length,
      learner: updates.filter(u => u.new_stage === "learner" && u.status === "success").length,
      ready: updates.filter(u => u.new_stage === "ready" && u.status === "success").length,
      serial_acquirer: updates.filter(u => u.new_stage === "serial_acquirer" && u.status === "success").length,
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: repreneurs.length,
        successful,
        failed,
        distribution,
      },
      updates,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
