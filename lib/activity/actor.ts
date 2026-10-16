import type { CurrentUserAccess } from "@/lib/access-control"
import type { ActivityEvent } from "@/lib/activity/activity-log"

type Actor = Pick<ActivityEvent, "actorUserId" | "actorRole" | "repreneurId">

/**
 * Who acted, from an access check the action already performed. Tolerates a
 * partial access record so building a log row can never fail the action.
 */
export function activityActor(access: Partial<CurrentUserAccess> | null | undefined): Actor {
  return {
    actorUserId: access?.user?.id ?? null,
    actorRole: access?.role ?? "unassigned",
    repreneurId: access?.repreneurId ?? null,
  }
}

/** Who acted, resolved from request headers after the response (route handlers). */
export async function activityActorFromHeaders(headers: Headers): Promise<Actor | null> {
  const { getCurrentUserAccessFromHeaders } = await import("@/lib/access-control")
  const access = await getCurrentUserAccessFromHeaders(headers)
  return access ? activityActor(access) : null
}

/** Who signed in, resolved from the new session's user id. */
export async function activityActorForUser(userId: string): Promise<Actor | null> {
  const [{ auth }, { resolveCurrentUserAccess }] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/access-control"),
  ])
  const context = await auth.$context
  const user = await context.internalAdapter.findUserById(userId)
  if (!user) return null
  const access = await resolveCurrentUserAccess(user)
  return access ? activityActor(access) : null
}
