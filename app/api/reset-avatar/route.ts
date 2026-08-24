import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createServerClient } from "@/lib/supabase/server"
import { getCurrentUserAccess } from "@/lib/access-control"
import { revalidateRepreneurDashboardTags } from "@/lib/data/dashboard-snapshots"

export async function POST(request: NextRequest) {
  try {
    const access = await getCurrentUserAccess()
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (access.role !== "staff") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = await createServerClient()

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
      return NextResponse.json({ error: "Unable to reset avatar" }, { status: 500 })
    }

    // Revalidate all pages that display repreneur data
    revalidatePath("/repreneurs")
    revalidatePath(`/repreneurs/${repreneurId}`)
    revalidatePath("/pipeline")
    revalidateRepreneurDashboardTags()

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
