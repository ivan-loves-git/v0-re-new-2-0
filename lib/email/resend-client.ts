import { Resend } from "resend"
import { env } from "@/lib/env"
import { assertQaMailEnvelope, qaMailPolicyFromEnv } from "@/lib/email/qa-mail-policy"

// Initialize Resend client
// API key must be set in environment variables
const provider = new Resend(env.RESEND_API_KEY)
export const resend = {
  emails: {
    send: async (...args: Parameters<typeof provider.emails.send>) => {
      const envelope = args[0]
      const policy = qaMailPolicyFromEnv()
      assertQaMailEnvelope({
        from: envelope.from,
        to: envelope.to,
        cc: envelope.cc,
        bcc: envelope.bcc,
      }, policy)
      if (policy.mode === "allowlist") return { data: { id: "qa-allowlist-accepted" }, error: null }
      return provider.emails.send(...args)
    },
  },
}

// Default from email - must be verified in Resend dashboard
export const FROM_EMAIL = env.RESEND_FROM_EMAIL
export const FROM_NAME = "Re-New"

// Free tier limits
export const DAILY_EMAIL_LIMIT = 100
export const MONTHLY_EMAIL_LIMIT = 3000
