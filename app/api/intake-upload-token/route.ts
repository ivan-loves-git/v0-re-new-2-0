import { NextResponse } from "next/server"
import { env } from "@/lib/env"
import {
  IntakeUploadSecurityError,
  issueIntakeUploadToken,
} from "@/lib/security/intake-upload"

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return process.env.NODE_ENV !== "production"

  try {
    const candidate = new URL(origin)
    const configured = new URL(env.BETTER_AUTH_URL)
    const requestHost = request.headers.get("host")
    return (
      candidate.origin === configured.origin ||
      (candidate.protocol === "https:" && candidate.host === requestHost)
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const token = await issueIntakeUploadToken(request)
    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof IntakeUploadSecurityError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : undefined,
        },
      )
    }
    console.error("Intake upload token error", error)
    return NextResponse.json(
      { error: "Upload authorization is temporarily unavailable." },
      { status: 503 },
    )
  }
}
