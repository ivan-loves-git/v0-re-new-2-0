import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Debug endpoint to test sign-in directly
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    console.log("[test-signin] Attempting sign in for:", email)

    const result = await auth.api.signInEmail({
      body: { email, password },
    })

    console.log("[test-signin] Sign in result:", result)

    return NextResponse.json({
      success: true,
      user: result.user,
      hasToken: !!result.token,
    })
  } catch (error: any) {
    console.error("[test-signin] Error:", error)
    return NextResponse.json(
      {
        error: error?.message || "Sign in failed",
        code: error?.code,
        stack: error?.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    )
  }
}
