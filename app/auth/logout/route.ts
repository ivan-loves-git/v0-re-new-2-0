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
  } catch {
    // Even if signOut fails, redirect to login
    console.error("Logout failed")
  }

  // Redirect to login page after logout and defensively expire auth cookies.
  // The routing gate may carry only this generic, allowlisted explanation.
  const loginUrl = new URL("/auth/login", origin)
  if (request.nextUrl.searchParams.get("reason") === "access_denied") {
    loginUrl.searchParams.set("reason", "access_denied")
  }
  const response = NextResponse.redirect(loginUrl)
  const cookieNames = [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_data",
    "better-auth.account_data",
    "__Secure-better-auth.account_data",
  ]

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    })
  }

  return response
}
