import { env } from "@/lib/env"
import { sendEmailDirect } from "@/lib/email/send-email"
import { LockedOpportunityInterestEmail } from "@/lib/email/templates/locked-opportunity-interest"
import type { LockedOpportunityInterestNotificationDetails } from "@/lib/locked-opportunity-interest"

const DEFAULT_STAFF_NOTIFICATION_EMAIL = "contact@re-new.team"
const DEFAULT_APP_URL = "https://app.re-new.team"

export async function sendLockedOpportunityInterestEmail(
  input: LockedOpportunityInterestNotificationDetails & {
    expressedAt: string
    idempotencyKey: string
  },
) {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "")

  return sendEmailDirect({
    to: env.RENEW_STAFF_NOTIFICATION_EMAIL ?? DEFAULT_STAFF_NOTIFICATION_EMAIL,
    subject: `Interest on positioned opportunity ${input.opportunityReference}`,
    idempotencyKey: input.idempotencyKey,
    react: LockedOpportunityInterestEmail({
      repreneurName: input.repreneurName,
      repreneurEmail: input.repreneurEmail,
      opportunityReference: input.opportunityReference,
      opportunityTitle: input.opportunityTitle,
      expressedAt: input.expressedAt,
      opportunityUrl: `${appUrl}/opportunities/${input.opportunityId}`,
      repreneurUrl: `${appUrl}/repreneurs/${input.repreneurId}`,
    }),
  })
}
