import { createAdminClient } from "@/lib/supabase/admin"
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
    to: input.recipientEmail, templateKey: "opportunity_memo_available", repreneurId: input.repreneurId,
    sourceContext: { kind: "memo_available", opportunityId: input.opportunityId, matchId: input.matchId, ...(input.grantEvidenceId ? { grantEvidenceId: input.grantEvidenceId } : {}) },
    ...(input.grantEvidenceId ? { beforeProviderAttempt: async () => {
      const { data, error } = await createAdminClient().rpc("authorize_opportunity_memo_grant_attempt", { p_grant_id: input.grantEvidenceId, p_token: input.attemptToken })
      if (error) throw new Error("The exact memo notice attempt is unavailable.")
      return data === true
    } } : {}),
    subject: `Le mémo d'information est disponible - ${input.opportunityTitle}`,
    idempotencyKey: input.idempotencyKey,
    react: OpportunityMemoAvailableEmail({
      firstName: input.repreneurFirstName,
      opportunityTitle: input.opportunityTitle,
      opportunityUrl: `${appUrl}/portal/deals/${input.matchId}`,
    }),
  })
}
