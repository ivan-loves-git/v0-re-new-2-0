import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { repreneurId } = await request.json()

    if (!repreneurId) {
      return NextResponse.json({ error: "Missing repreneurId" }, { status: 400 })
    }

    // Clear the avatar_url in the database
    const { error } = await supabase
      .from("repreneurs")
      .update({ avatar_url: null })
      .eq("id", repreneurId)

    if (error) {
      console.error("Database update error:", error.message, error)
      return NextResponse.json({ error: `Failed to reset avatar: ${error.message}` }, { status: 500 })
    }

    // Revalidate all pages that display repreneur data
    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${repreneurId}`)
    revalidatePath("/pipeline")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reset avatar error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
