import { env } from "@/lib/env"
import { sendEmailDirect } from "@/lib/email/send-email"
import { OpportunityMemoAvailableEmail } from "@/lib/email/templates/opportunity-memo-available"
import type { OpportunityMemoNotificationClaim } from "@/lib/opportunity-memo-notification"

const DEFAULT_APP_URL = "https://app.re-new.team"

export async function sendOpportunityMemoAvailableEmail(
  input: OpportunityMemoNotificationClaim & { idempotencyKey: string },
) {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "")

  return sendEmailDirect({
    to: input.recipientEmail,
    subject: `Le mémo d'information est disponible - ${input.opportunityTitle}`,
    idempotencyKey: input.idempotencyKey,
    react: OpportunityMemoAvailableEmail({
      firstName: input.repreneurFirstName,
      opportunityTitle: input.opportunityTitle,
      opportunityUrl: `${appUrl}/portal/deals/${input.matchId}`,
    }),
  })
}
