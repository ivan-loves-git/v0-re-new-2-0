import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"
import {
  consumeRequestRateLimit,
  requestFingerprint,
} from "@/lib/security/intake-upload"

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
  "/api/auth/forget-password": { max: 3, window: 15 * 60 },
  "/api/auth/reset-password": { max: 5, window: 15 * 60 },
  "/api/auth/sign-up/email": { max: 1, window: 60 * 60 },
}

export const GET = handlers.GET

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

  return handlers.POST(request)
}
