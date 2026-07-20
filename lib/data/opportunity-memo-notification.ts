import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  OpportunityMemoNotificationClaim,
  OpportunityMemoNotificationStore,
} from "@/lib/opportunity-memo-notification"

interface ClaimRow {
  match_id: string
  opportunity_id: string
  repreneur_id: string
  recipient_email: string
  repreneur_first_name: string
  opportunity_title: string
}

function requireSuccessfulWrite(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

export function createOpportunityMemoNotificationStore(): OpportunityMemoNotificationStore {
  return {
    async claim(input): Promise<OpportunityMemoNotificationClaim | null> {
      const supabase = createAdminClient()
      const { data, error } = await supabase.rpc("claim_opportunity_memo_notification", {
        p_opportunity_id: input.opportunityId,
        p_match_id: input.matchId ?? null,
        p_attempted_at: input.attemptedAt,
      })

      requireSuccessfulWrite(error, "Could not claim info memo notification")
      const row = ((data ?? []) as ClaimRow[])[0]
      if (!row) return null

      return {
        matchId: row.match_id,
        opportunityId: row.opportunity_id,
        repreneurId: row.repreneur_id,
        recipientEmail: row.recipient_email,
        repreneurFirstName: row.repreneur_first_name,
        opportunityTitle: row.opportunity_title,
      }
    },

    async markSent(input) {
      const supabase = createAdminClient()
      const { error } = await supabase.rpc("complete_opportunity_memo_notification", {
        p_match_id: input.matchId,
        p_sent_at: input.sentAt,
        p_provider_id: input.providerId ?? null,
      })

      requireSuccessfulWrite(error, "Could not complete info memo notification")
    },

    async markFailed(input) {
      const supabase = createAdminClient()
      const { error } = await supabase.rpc("fail_opportunity_memo_notification", {
        p_match_id: input.matchId,
        p_failed_at: input.failedAt,
        p_error: input.error.slice(0, 1000),
      })

      requireSuccessfulWrite(error, "Could not record info memo notification failure")
    },
  }
}
