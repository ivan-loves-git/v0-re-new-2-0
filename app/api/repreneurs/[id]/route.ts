import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { getCurrentUserAccess } from "@/lib/access-control"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  const access = await getCurrentUserAccess()
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (access.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("repreneurs")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}
