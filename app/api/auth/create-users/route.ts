import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { env } from "@/lib/env"

/**
 * API route to create initial users in Better Auth
 * Call this once after deployment: POST /api/auth/create-users
 *
 * Requires passwords to be passed in the request body.
 * Protected by admin secret header in production.
 */

export async function POST(request: Request) {
  try {
    // Security: Check for admin secret in production
    const adminSecret = request.headers.get("x-admin-secret")
    const expectedSecret = env.BETTER_AUTH_SECRET

    if (process.env.NODE_ENV === "production" && adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized. Provide x-admin-secret header." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const users = body.users as Array<{ email: string; password: string; name: string }>

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a 'users' array with email, password, and name fields." },
        { status: 400 }
      )
    }

    const results: Array<{ email: string; status: string; error?: string }> = []

    for (const user of users) {
      if (!user.email || !user.password || !user.name) {
        results.push({ email: user.email || "unknown", status: "error", error: "Missing required fields" })
        continue
      }

      try {
        const result = await auth.api.signUpEmail({
          body: {
            email: user.email,
            password: user.password,
            name: user.name,
          },
        })

        if (result?.user) {
          results.push({ email: user.email, status: "created" })
        } else {
          results.push({ email: user.email, status: "unknown" })
        }
      } catch (error: any) {
        const errorMessage = error?.message || String(error)
        if (
          errorMessage.includes("already exists") ||
          errorMessage.includes("User already exists") ||
          error?.code === "USER_ALREADY_EXISTS"
        ) {
          results.push({ email: user.email, status: "already_exists" })
        } else {
          results.push({ email: user.email, status: "error", error: errorMessage })
        }
      }
    }

    const created = results.filter((r) => r.status === "created").length
    const existing = results.filter((r) => r.status === "already_exists").length
    const errors = results.filter((r) => r.status === "error").length

    return NextResponse.json({
      success: true,
      summary: {
        created,
        already_exists: existing,
        errors,
        total: users.length,
      },
      results,
    })
  } catch (error: any) {
    console.error("Create users error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to create users" },
      { status: 500 }
    )
  }
}
