import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

export type StaffInterestRejection = {
  interest_expressed_at: string | null
  reason: string
  decided_at: string
  decided_by: string
  delivery_status: "pending" | "failed" | "sent" | "suppressed" | "review_required"
}

export type StaffInterestWithdrawal = {
  interest_expressed_at: string
  reason: string
  withdrawn_at: string
  actor: string
  origin: "owner" | "staff"
}

/** The only app reader of private reasons. Callers authenticate staff first;
 * the service-only RPC independently checks the exact staff actor. */
export async function withStaffInterestRejections<T extends { id: string; status?: string; interest_expressed_at?: string | null }>(rows: T[], actorId: string): Promise<(T & { interest_rejection?: StaffInterestRejection | null; interest_withdrawal?: StaffInterestWithdrawal | null })[]> {
  if (rows.length === 0) return rows
  const byMatch = new Map<string, StaffInterestRejection>()
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { data, error } = await createAdminClient().rpc("w173_staff_rejections", {
      p_actor: actorId,
      p_match_ids: rows.slice(offset, offset + 100).map((row) => row.id),
    })
    if (error) throw new Error("Could not read staff interest decisions.")
    for (const decision of data ?? []) {
      byMatch.set(decision.match_id, {
        interest_expressed_at: decision.interest_expressed_at,
        reason: decision.reason,
        decided_at: decision.decided_at,
        decided_by: decision.decided_by,
        delivery_status: decision.delivery_status,
      })
    }
  }
  const withdrawnRows = rows.filter((row) => row.status === "withdrawn" && row.interest_expressed_at)
  const withdrawals = new Map<string, StaffInterestWithdrawal>()
  for (let offset = 0; offset < withdrawnRows.length; offset += 100) {
    const { data, error } = await createAdminClient().rpc("w192_staff_withdrawals", {
      p_actor: actorId,
      p_match_ids: withdrawnRows.slice(offset, offset + 100).map((row) => row.id),
    })
    if (error) throw new Error("Could not read staff interest withdrawals.")
    for (const event of data ?? []) {
      if (!event.reason || (event.origin !== "owner" && event.origin !== "staff")) continue
      withdrawals.set(event.match_id, {
        interest_expressed_at: event.interest_expressed_at,
        reason: event.reason,
        withdrawn_at: event.withdrawn_at,
        actor: event.actor,
        origin: event.origin,
      })
    }
  }
  return rows.map((row) => ({ ...row, interest_rejection: byMatch.get(row.id) ?? null,
    interest_withdrawal: withdrawals.get(row.id) ?? null }))
}

/** Portal receives only a boolean for its own exact matches: never actor,
 * private reason, source identity or a broader match list. */
export async function readRepreneurInterestStates(
  repreneurId: string,
  matches: { id: string; interest_expressed_at?: string | null }[],
) {
  const matchIds = matches.map((match) => match.id)
  const rejected = new Set<string>()
  for (let offset = 0; offset < matchIds.length; offset += 100) {
    const { data, error } = await createAdminClient().rpc("w173_repreneur_rejections", {
      p_repreneur_id: repreneurId,
      p_match_ids: matchIds.slice(offset, offset + 100),
    })
    if (error) throw new Error("Could not read current interest outcomes.")
    for (const row of data ?? []) rejected.add(row.match_id)
  }
  const proposed = new Set<string>()
  for (let offset = 0; offset < matchIds.length; offset += 100) {
    const { data, error } = await createAdminClient().from("opportunity_interest_events")
      .select("match_id,interest_expressed_at")
      .in("match_id", matchIds.slice(offset, offset + 100))
      .eq("event_type", "proposed_interested")
    if (error) throw new Error("Could not read response origin.")
    const currentInterest = new Map(matches.map((match) => [match.id, match.interest_expressed_at ?? null]))
    for (const event of data ?? []) {
      if (currentInterest.get(event.match_id) === event.interest_expressed_at) proposed.add(event.match_id)
    }
  }
  return { rejected, proposed }
}
