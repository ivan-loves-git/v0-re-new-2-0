import { auth } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"

export async function GET(request: NextRequest) {
  // Get the origin from the request to build the redirect URL
  const origin = request.nextUrl.origin

  try {
    // Sign out using Better Auth
    await auth.api.signOut({
      headers: await headers(),
    })
  } catch (error) {
    // Even if signOut fails, redirect to login
    console.error("Logout error:", error)
  }

  // Redirect to login page after logout
  return NextResponse.redirect(new URL("/auth/login", origin))
}
