import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"
import { trustedAuthOrigins } from "@/lib/auth-origin-policy"
import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { env } from "@/lib/env"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import { authorizePasswordResetDelivery } from "@/lib/password-reset-link"

/**
 * Database connection pool singleton
 * Prevents creating new connections on every import in serverless environment
 */
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Required for Supabase
      },
      max: 5, // Limit connections for serverless
    })
  }
  return pool
}

function isPortalAccessSetupUrl(url: string) {
  try {
    const callbackURL = new URL(url).searchParams.get("callbackURL")
    if (!callbackURL) return false
    const callback = new URL(callbackURL, env.BETTER_AUTH_URL)
    return callback.searchParams.get("intent") === "portal"
  } catch {
    return false
  }
}

function renderPortalAccessSetupEmail(
  name: string | null | undefined,
  url: string,
) {
  const displayName = name?.trim() || "Bonjour"

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.5;">
      <h2 style="color: #111827; margin-bottom: 16px;">Bienvenue sur la plateforme Re-New</h2>
      <p>Bonjour ${displayName},</p>
      <p>L'equipe Re-New vous a ouvert un acces a la plateforme.</p>
      <p>Pour finaliser votre acces, cliquez sur le bouton ci-dessous et creez votre mot de passe.</p>
      <p style="margin: 28px 0;">
        <a href="${url}" style="background: #111827; color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: 600;">
          Creer mon mot de passe
        </a>
      </p>
      <p style="color: #4b5563; font-size: 14px;">Ce lien expire dans 1 heure. Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">Re-New Platform</p>
    </div>
  `
}

function renderPasswordResetEmail(
  name: string | null | undefined,
  url: string,
) {
  const displayName = name?.trim() || "there"

  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #3b82f6;">Reset Your Password</h2>
      <p>Hi ${displayName},</p>
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
  `
}

const authTrustedOrigins = trustedAuthOrigins({
  betterAuthUrl: env.BETTER_AUTH_URL,
  betterAuthTrustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  nodeEnv: env.NODE_ENV,
  vercelUrl: process.env.VERCEL_URL,
  vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
  vercelProjectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
})

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
  baseURL: env.BETTER_AUTH_URL,
  database: getPool(),

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    // WAVE access is provisioned by staff. Public self-registration would let
    // an attacker preclaim a repreneur email before the legitimate invitation.
    disableSignUp: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url, token }) => {
      const trace = startCriticalOperation("email.password_reset_send")
      try {
        const deliveryAuthorized = await authorizePasswordResetDelivery(
          user.id,
          token,
        )
        if (!deliveryAuthorized) {
          trace.success()
          return
        }

        const isPortalAccessSetup = isPortalAccessSetupUrl(url)
        const { error } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: user.email,
          subject: isPortalAccessSetup
            ? "Bienvenue sur la plateforme Re-New"
            : "Reset your password",
          html: isPortalAccessSetup
            ? renderPortalAccessSetupEmail(user.name, url)
            : renderPasswordResetEmail(user.name, url),
        })
        if (error) {
          trace.failure("provider_rejected")
          throw new Error(`Failed to send reset email: ${error.message}`)
        }
        trace.success()
      } catch (err) {
        trace.failure("provider_unavailable")
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
    ipAddress: {
      ipAddressHeaders: [
        "x-vercel-forwarded-for",
        "x-forwarded-for",
        "cf-connecting-ip",
        "x-real-ip",
      ],
    },
  },

  // Database-backed limits apply consistently across Vercel instances.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 5 },
      "/request-password-reset": { window: 15 * 60, max: 3 },
      "/reset-password": { window: 15 * 60, max: 5 },
      "/sign-up/email": { window: 60 * 60, max: 1 },
    },
  },

  // Exact server-owned origins only. Never reflect the caller's Origin header
  // into Better Auth's allowlist.
  trustedOrigins: authTrustedOrigins,
})

// Export types for client-side usage
export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
