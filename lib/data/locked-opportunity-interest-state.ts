import type { createAdminClient } from "@/lib/supabase/admin"

export interface LockedOpportunityInterestState {
  interest_expressed_at: string | null
  interest_notification_sent_at: string | null
}

function isMissingInterestColumns(error: { code?: string; message?: string }) {
  return error.code === "42703"
    || error.code === "PGRST204"
    || Boolean(error.message?.includes("interest_expressed_at"))
}

export async function listLockedOpportunityInterestStateByMatch(
  supabase: ReturnType<typeof createAdminClient>,
  matchIds: string[],
) {
  if (matchIds.length === 0) return new Map<string, LockedOpportunityInterestState>()

  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("id, interest_expressed_at, interest_notification_sent_at")
    .in("id", matchIds)

  // The read surface stays deploy-safe while migration 067 is rolling out.
  // The mutation remains unavailable until the RPC and columns are installed.
  if (error && isMissingInterestColumns(error)) {
    return new Map<string, LockedOpportunityInterestState>()
  }
  if (error) throw new Error(error.message)

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        interest_expressed_at: row.interest_expressed_at,
        interest_notification_sent_at: row.interest_notification_sent_at,
      },
    ]),
  )
}
