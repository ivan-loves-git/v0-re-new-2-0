import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/** Called solely from the existing authenticated daily maintenance route. */
export async function purgeExpiredRepreneurFeedback(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("purge_expired_repreneur_feedback")
  if (error || typeof data !== "number") {
    throw new Error("Repreneur feedback cleanup failed")
  }
  return data
}
