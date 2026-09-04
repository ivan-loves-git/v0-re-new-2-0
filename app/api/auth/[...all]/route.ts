import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"
import {
  consumeRequestRateLimit,
  requestFingerprint,
} from "@/lib/security/intake-upload"
import { withPasswordResetAuthority } from "@/lib/password-reset-link"

/**
 * Better Auth API route handler
 * Handles all auth-related requests: sign in, sign up, sign out, session, etc.
 *
 * Endpoints:
 * - POST /api/auth/sign-in/email - Email/password sign in
 * - POST /api/auth/sign-up/email - Email/password sign up
 * - POST /api/auth/sign-out - Sign out
 * - GET /api/auth/session - Get current session
 */
const handlers = toNextJsHandler(auth)

const AUTH_RATE_LIMITS: Record<string, { max: number; window: number }> = {
  "/api/auth/sign-in/email": { max: 5, window: 15 * 60 },
  "/api/auth/request-password-reset": { max: 3, window: 15 * 60 },
  "/api/auth/reset-password": { max: 5, window: 15 * 60 },
  "/api/auth/sign-up/email": { max: 1, window: 60 * 60 },
}

const RESET_LINK_PRIVACY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

function withResetLinkPrivacyHeaders(response: Response) {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(RESET_LINK_PRIVACY_HEADERS)) {
    headers.set(name, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export async function GET(request: Request) {
  const pathname = new URL(request.url).pathname
  const response = await handlers.GET(request)
  return pathname.startsWith("/api/auth/reset-password/")
    ? withResetLinkPrivacyHeaders(response)
    : response
}

function invalidResetTokenResponse() {
  return Response.json(
    { code: "INVALID_TOKEN", message: "Invalid token" },
    { status: 400 },
  )
}

async function resetTokenFromRequest(request: Request) {
  try {
    const body = (await request.clone().json()) as { token?: unknown }
    if (typeof body.token === "string") return body.token
  } catch {
    // Better Auth returns the same privacy-safe invalid-token result below.
  }

  return new URL(request.url).searchParams.get("token")
}

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname
  const rule = AUTH_RATE_LIMITS[pathname]

  if (rule) {
    try {
      const fingerprint = requestFingerprint(request)
      const limit = await consumeRequestRateLimit(
        `auth:${pathname}:${fingerprint}`,
        rule.max,
        rule.window,
      )
      if (!limit.allowed) {
        return Response.json(
          { message: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: { "Retry-After": String(limit.retryAfter) },
          },
        )
      }
    } catch (error) {
      console.error("Authentication rate limit unavailable", error)
      return Response.json(
        { message: "Authentication is temporarily unavailable." },
        { status: 503 },
      )
    }
  }

  if (pathname === "/api/auth/reset-password") {
    const token = await resetTokenFromRequest(request)
    try {
      const guarded = await withPasswordResetAuthority(token, () =>
        handlers.POST(request),
      )
      return guarded.authorized ? guarded.result : invalidResetTokenResponse()
    } catch {
      console.error("Password reset authority was unavailable.")
      return Response.json(
        {
          code: "RESET_AUTHORITY_UNAVAILABLE",
          message: "Password reset is temporarily unavailable.",
        },
        { status: 503 },
      )
    }
  }

  return handlers.POST(request)
}
