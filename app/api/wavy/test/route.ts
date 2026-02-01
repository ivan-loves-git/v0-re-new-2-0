import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Debug endpoint - remove after testing
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("repreneurs")
      .select("id, first_name, last_name, email, rejected_at")
      .is("rejected_at", null)
      .order("first_name")
      .limit(10)

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      error: error?.message || null,
      repreneurs: data?.map(r => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name}`,
        email: r.email,
        rejectedAt: r.rejected_at
      }))
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 })
  }
}
