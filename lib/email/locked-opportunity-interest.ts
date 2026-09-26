import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmailDirect } from "@/lib/email/send-email"
import { LockedOpportunityInterestEmail } from "@/lib/email/templates/locked-opportunity-interest"
import type { LockedOpportunityInterestNotificationDetails } from "@/lib/locked-opportunity-interest"

const DEFAULT_STAFF_NOTIFICATION_EMAIL = "contact@re-new.team"
const DEFAULT_APP_URL = "https://app.re-new.team"

export async function sendLockedOpportunityInterestEmail(
  input: LockedOpportunityInterestNotificationDetails & {
    matchId: string
    expressedAt: string
    idempotencyKey: string
  },
) {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "")
  const db = createAdminClient()
  const { data: prior, error: priorError } = await db.from("opportunity_interest_direct_notices")
    .select("status")
    .eq("match_id", input.matchId)
    .eq("interest_expressed_at", input.expressedAt)
    .maybeSingle()
  if (priorError) throw new Error("Could not verify exact interest notice state.")
  if (prior?.status === "sent") return { success: true }
  let began = false

  const result = await sendEmailDirect({
    to: env.RENEW_STAFF_NOTIFICATION_EMAIL ?? DEFAULT_STAFF_NOTIFICATION_EMAIL,
    subject: `Nouvel intérêt repreneur — ${input.opportunityTitle}`,
    idempotencyKey: input.idempotencyKey,
    beforeProviderAttempt: async () => {
      const { data, error } = await db.rpc("w192_begin_direct_interest_notice", {
        p_match_id: input.matchId,
        p_interest_at: input.expressedAt,
      })
      if (error) throw new Error("Could not verify current exact interest before provider I/O.")
      began = data === true
      return began
    },
    react: LockedOpportunityInterestEmail({
      repreneurName: input.repreneurName,
      repreneurEmail: input.repreneurEmail,
      opportunityReference: input.opportunityReference,
      opportunityTitle: input.opportunityTitle,
      expressedAt: input.expressedAt,
      opportunityUrl: `${appUrl}/opportunities/${input.opportunityId}`,
      repreneurUrl: `${appUrl}/repreneurs/${input.repreneurId}`,
      hasOtherActivePursuit: input.hasOtherActivePursuit,
    }),
  })
  if (!began) {
    const { data: after, error } = await db.from("opportunity_interest_direct_notices")
      .select("status")
      .eq("match_id", input.matchId)
      .eq("interest_expressed_at", input.expressedAt)
      .maybeSingle()
    if (error) throw new Error("Could not reconcile exact interest notice state.")
    return after?.status === "sent" ? { success: true } : result
  }
  const outcome = result.success && result.resendId ? "sent"
    : result.providerOutcome === "rejected" ? "rejected" : "uncertain"
  const { data: completed, error: completeError } = await db.rpc("w192_complete_direct_interest_notice", {
    p_match_id: input.matchId,
    p_interest_at: input.expressedAt,
    p_outcome: outcome,
    p_provider_message_id: result.resendId ?? null,
  })
  if (completeError || completed !== outcome) throw new Error("Could not record exact interest provider outcome.")
  return outcome === "sent" ? result : { success: false, error: result.error ?? "Staff notice requires review." }
}
