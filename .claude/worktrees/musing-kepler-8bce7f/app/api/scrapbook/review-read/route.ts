import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
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
