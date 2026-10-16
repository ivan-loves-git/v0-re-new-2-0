import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * WAVE activity log (#268): one append-only row per buyer or staff action in
 * `wave_activity_events`, kept in WAVE's own database. Recording happens
 * after the response and never blocks or fails the person's action.
 */

export const ACTIVITY_ACTIONS = [
  "auth.signed_in",
  "portal.deal_opened",
  "portal.memo_opened",
  "portal.nda_template_downloaded",
  "portal.interest_expressed",
  "portal.interest_declined",
  "portal.interest_withdrawn",
  "profile.target_thesis_changed",
  "profile.contribution_certified",
  "profile.language_changed",
  "mcp.connected",
  "mcp.tool_called",
] as const

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]
export type ActivityActorRole = "staff" | "repreneur" | "unassigned" | "system"

export interface ActivityEvent {
  action: ActivityAction
  actorUserId: string | null
  actorRole: ActivityActorRole
  repreneurId?: string | null
  opportunityId?: string | null
  matchId?: string | null
  details?: Record<string, unknown>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uuidOrNull(value: string | null | undefined) {
  return typeof value === "string" && UUID.test(value) ? value : null
}

/** The stored row; ids that are not UUIDs are dropped rather than failing the insert. */
export function activityRow(event: ActivityEvent, occurredAt: Date) {
  return {
    occurred_at: occurredAt.toISOString(),
    action: event.action,
    actor_user_id: event.actorUserId || null,
    actor_role: event.actorRole,
    repreneur_id: uuidOrNull(event.repreneurId),
    opportunity_id: uuidOrNull(event.opportunityId),
    match_id: uuidOrNull(event.matchId),
    details: event.details ?? {},
  }
}

/** Writes one row now. Never throws: a lost log row must not undo the action. */
export async function insertActivity(
  event: ActivityEvent,
  occurredAt: Date = new Date(),
  client: Pick<SupabaseClient, "from"> = createAdminClient(),
) {
  try {
    const { error } = await client.from("wave_activity_events").insert(activityRow(event, occurredAt))
    if (error) throw new Error(error.message)
    return true
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "wave_activity.record_failed",
        action: event.action,
        error: error instanceof Error ? error.message : "unknown",
      }),
    )
    return false
  }
}

/**
 * Queues one row for after the response. `resolve` may look up the actor or
 * other context late, so the person's request does not wait for it. Outside a
 * request (scripts, tests) nothing is recorded.
 */
export function recordActivity(
  event: ActivityEvent | (() => Promise<ActivityEvent | null>),
) {
  const occurredAt = new Date()
  try {
    after(async () => {
      try {
        const resolved = typeof event === "function" ? await event() : event
        if (resolved) await insertActivity(resolved, occurredAt)
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "wave_activity.record_failed",
            error: error instanceof Error ? error.message : "unknown",
          }),
        )
      }
    })
    return true
  } catch {
    return false
  }
}

/** Each changed field with its previous and new value; unchanged fields are left out. */
export function fieldChanges(
  before: Record<string, unknown> | null | undefined,
  afterValues: Record<string, unknown>,
) {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [field, value] of Object.entries(afterValues)) {
    const previous = before?.[field] ?? null
    if (JSON.stringify(previous) !== JSON.stringify(value ?? null)) {
      changes[field] = { from: previous, to: value ?? null }
    }
  }
  return changes
}
