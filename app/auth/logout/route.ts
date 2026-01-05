import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  await supabase.auth.signOut()

  // Get the origin from the request to build the redirect URL
  const origin = request.nextUrl.origin

  // Redirect to login page after logout
  return NextResponse.redirect(new URL("/auth/login", origin))
}
