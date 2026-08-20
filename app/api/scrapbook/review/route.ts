import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUserAccess } from "@/lib/access-control"
import { plainTextToSafeHtml } from "@/lib/security/sanitize-html"

export async function POST(request: NextRequest) {
  const access = await getCurrentUserAccess()
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (access.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { title, content } = await request.json()

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const htmlContent = plainTextToSafeHtml(content)

  const { error } = await supabase.from("clipboard").upsert(
    {
      slug: "review",
      title: title || "Review",
      html_content: htmlContent,
      created_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  )

  if (error) {
    return NextResponse.json({ error: "Unable to save review" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
