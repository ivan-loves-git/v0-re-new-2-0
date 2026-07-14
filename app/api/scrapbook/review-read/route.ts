import { connection, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUserAccess } from "@/lib/access-control"
import { sanitizePublicHtml } from "@/lib/security/sanitize-html"

export async function GET() {
  await connection()
  const access = await getCurrentUserAccess()
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (access.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  return NextResponse.json({
    ...data,
    html_content: sanitizePublicHtml(data.html_content),
  })
}
