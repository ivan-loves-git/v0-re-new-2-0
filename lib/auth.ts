import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

/**
 * Better Auth server configuration
 * Uses Supabase PostgreSQL for storage
 *
 * Required environment variables:
 * - DATABASE_URL: PostgreSQL connection string (from Supabase dashboard)
 * - BETTER_AUTH_SECRET: 32+ character secret for encryption
 * - BETTER_AUTH_URL: Base URL of the app (e.g., http://localhost:3000)
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Supabase
    },
  }),

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Plugins
  plugins: [
    nextCookies(), // Enables Server Component cookie support
  ],

  // Security settings
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // Trusted origins for CORS
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3000",
    "https://v0-re-new-2-0.vercel.app",
  ],
})

// Export types for client-side usage
export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
