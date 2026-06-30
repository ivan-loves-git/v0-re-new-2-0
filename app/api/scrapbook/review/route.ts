import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth-server"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title, content } = await request.json()

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  const htmlContent = content
    .split("\n\n")
    .filter((p: string) => p.trim())
    .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n")

  const { error } = await supabase.from("clipboard").upsert(
    {
      slug: "review",
      title: title || "Review",
      html_content: htmlContent,
      created_at: new Date().toISOString(),
    },
    { onConflict: "slug" }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
