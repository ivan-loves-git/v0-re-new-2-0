import "server-only"

import type { createAdminClient } from "@/lib/supabase/admin"

/** Read only explicit, exact-member confirmed-open replies. The RPC is
 * service-only and projects one latest confirmation per opportunity. */
export async function readOpportunityFreshnessConfirmations(
  db: ReturnType<typeof createAdminClient>,
  opportunityIds: string[],
) {
  const confirmations = new Map<string, { id: string; at: string }>()
  const uniqueIds = [...new Set(opportunityIds)]
  for (let start = 0; start < uniqueIds.length; start += 100) {
    const { data, error } = await db.rpc("opportunity_freshness_latest_confirmations", {
      p_opportunity_ids: uniqueIds.slice(start, start + 100),
    })
    if (error) throw new Error("The source confirmation clock is unavailable.")
    for (const row of data ?? []) {
      confirmations.set(row.opportunity_id, { id: row.confirmation_id, at: row.confirmed_at })
    }
  }
  return confirmations
}
