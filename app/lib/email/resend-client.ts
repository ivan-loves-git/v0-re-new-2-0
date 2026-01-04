import { Resend } from "resend"

// Initialize Resend client
// API key must be set in environment variables
const resendApiKey = process.env.RESEND_API_KEY

if (!resendApiKey) {
  console.warn("RESEND_API_KEY is not set. Email sending will fail.")
}

export const resend = new Resend(resendApiKey)

// Default from email - must be verified in Resend dashboard
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@re-new.com"
export const FROM_NAME = "Re-New"

// Free tier limits
export const DAILY_EMAIL_LIMIT = 100
export const MONTHLY_EMAIL_LIMIT = 3000
