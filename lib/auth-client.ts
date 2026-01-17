import { createAuthClient } from "better-auth/react"

/**
 * Better Auth client for React components
 * Used for sign in, sign out, and session management
 */
export const authClient = createAuthClient({
  // baseURL is optional when running on the same domain
  // The client will automatically use the current origin
})

// Export commonly used functions and hooks
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient
