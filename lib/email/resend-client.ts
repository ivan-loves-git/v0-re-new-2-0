import { Resend } from "resend"
import { env } from "@/lib/env"

// Initialize Resend client
// API key must be set in environment variables
export const resend = new Resend(env.RESEND_API_KEY)

// Default from email - must be verified in Resend dashboard
export const FROM_EMAIL = env.RESEND_FROM_EMAIL
export const FROM_NAME = "Re-New"

// Free tier limits
export const DAILY_EMAIL_LIMIT = 100
export const MONTHLY_EMAIL_LIMIT = 3000
