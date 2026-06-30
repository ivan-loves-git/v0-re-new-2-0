import { connection, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth-server"

export async function GET() {
  await connection()
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("clipboard")
    .select("title, html_content")
    .eq("slug", "review")
    .single()

  if (error || !data) {
    return NextResponse.json({})
  }

  return NextResponse.json(data)
}
