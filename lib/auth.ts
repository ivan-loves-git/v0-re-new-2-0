import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"
import { resend, FROM_EMAIL, FROM_NAME } from "@/lib/email/resend-client"

/**
 * Database connection pool singleton
 * Prevents creating new connections on every import in serverless environment
 */
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase
      },
      max: 5, // Limit connections for serverless
    })
  }
  return pool
}

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
  database: getPool(),

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      try {
        console.log("[auth] Sending password reset email to:", user.email)
        console.log("[auth] RESEND_API_KEY set:", !!process.env.RESEND_API_KEY)
        const { data, error } = await resend.emails.send({
          from: "Re-New <notifications@news.re-new.team>",
          to: user.email,
          subject: "Reset your password",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #3b82f6;">Reset Your Password</h2>
              <p>Hi ${user.name || "there"},</p>
              <p>We received a request to reset your password. Click the button below to choose a new password:</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
                  Reset Password
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Re-New Platform</p>
            </div>
          `,
        })
        if (error) {
          console.error("[auth] Resend error:", JSON.stringify(error))
          throw new Error(`Failed to send reset email: ${error.message}`)
        }
        console.log("[auth] Reset email sent successfully:", data?.id)
      } catch (err) {
        console.error("[auth] sendResetPassword failed:", err)
        throw err
      }
    },
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

  // Rate limiting (disabled for initial setup, re-enable later)
  rateLimit: {
    enabled: false,
  },

  // Trusted origins for CORS
  trustedOrigins: (origin) => {
    const trusted = [
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
      "https://app.re-new.team",
    ]
    if (trusted.includes(origin)) return true
    // Allow Vercel preview deployments and V0 app builder
    if (origin.endsWith(".vercel.app")) return true
    if (origin.endsWith(".v0.dev") || origin === "https://v0.dev") return true
    if (origin.endsWith(".v0.app") || origin === "https://v0.app") return true
    return false
  },
})

// Export types for client-side usage
export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
