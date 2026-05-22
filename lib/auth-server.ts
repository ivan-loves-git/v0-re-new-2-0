import { cache } from "react"
import { headers } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { auth } from "@/lib/auth"

/**
 * Get the current authenticated user from Better Auth on the server side.
 * Use this in Server Components and Server Actions.
 *
 * @returns The current user or null if not authenticated
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const requestHeaders = await headers()

  try {
    const session = await auth.api.getSession({
      headers: requestHeaders,
    })

    if (!session?.user) {
      return null
    }

    return session.user
  } catch (error) {
    unstable_rethrow(error)
    console.error("Error getting current user:", error)
    return null
  }
})

/**
 * Get the current authenticated user, throwing if not authenticated.
 * Use this in protected Server Actions where authentication is required.
 *
 * @throws Error if not authenticated
 * @returns The current user
 */
export const requireUser = cache(async function requireUser() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  return user
})
