import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"

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
export const { GET, POST } = toNextJsHandler(auth)
