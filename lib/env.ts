import { z } from "zod"
import "server-only"

/**
 * Environment variable validation using Zod
 * This runs at build/startup time to catch missing env vars early
 */

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Better Auth
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),

  // Resend (email)
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL must be a valid email").default("noreply@re-new.com"),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  RENEW_STAFF_NOTIFICATION_EMAIL: z.string().email("RENEW_STAFF_NOTIFICATION_EMAIL must be a valid email").optional(),

  // Vercel Cron
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  CC_ON_INTERVIEW_REMINDER: z.string().email("CC_ON_INTERVIEW_REMINDER must be a valid email").optional(),

  // AI features
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Public feature configuration
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  NEXT_PUBLIC_DUAL_SCORING: z.string().optional(),
  NEXT_PUBLIC_INTAKE_V2: z.string().optional(),
  NEXT_PUBLIC_SHOW_SCORE_BREAKDOWN: z.string().optional(),
  NEXT_PUBLIC_SHOW_TEST_AUTOFILL: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error("Invalid environment variables:")
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error("Invalid environment variables. Check server logs for details.")
  }

  return parsed.data
}

// Validate on import (fails fast at startup)
export const env = validateEnv()
