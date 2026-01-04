import { Resend } from "resend"

// Initialize Resend client
// API key must be set in environment variables
const resendApiKey = process.env.RESEND_API_KEY

// Use placeholder during build to prevent errors
// Runtime checks in send-email.ts will catch missing key
export const resend = new Resend(resendApiKey || "re_placeholder_for_build")

// Default from email - must be verified in Resend dashboard
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@re-new.com"
export const FROM_NAME = "Re-New"

// Free tier limits
export const DAILY_EMAIL_LIMIT = 100
export const MONTHLY_EMAIL_LIMIT = 3000
