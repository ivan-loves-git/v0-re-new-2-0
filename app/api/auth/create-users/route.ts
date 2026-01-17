import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * API route to create initial users in Better Auth
 * Call this once after deployment: POST /api/auth/create-users
 *
 * This is protected - only works if no users exist yet OR
 * requires a secret header in production
 */

const INITIAL_USERS = [
  {
    email: "bertrand.galas@edu.escp.eu",
    password: "Wave2025!",
    name: "Bertrand",
  },
  {
    email: "amelie.lyon@edu.escp.eu",
    password: "Wave2025!",
    name: "Amélie",
  },
  {
    email: "antoine.duchene@edu.escp.eu",
    password: "Wave2025!",
    name: "Antoine",
  },
  {
    email: "renew@icpteam.eu",
    password: "Wave2025!",
    name: "ICP Team",
  },
]

export async function POST(request: Request) {
  try {
    // Security: Check for admin secret in production
    const adminSecret = request.headers.get("x-admin-secret")
    const expectedSecret = process.env.BETTER_AUTH_SECRET

    if (process.env.NODE_ENV === "production" && adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized. Provide x-admin-secret header." },
        { status: 401 }
      )
    }

    const results: Array<{ email: string; status: string; error?: string }> = []

    for (const user of INITIAL_USERS) {
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
        total: INITIAL_USERS.length,
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
