"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUserAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ExternalPursuitCapacitySnapshot,
  ExternalPursuitConfirmationResult,
} from "@/lib/types/external-pursuit-capacity"

function friendlyError(error: unknown, fallback: string) {
  return error instanceof Error && /denied|not found|not open capacity|required/i.test(error.message)
    ? error.message
    : fallback
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** The only read path for capacity is staff-only, server-side and role-checked twice. */
export async function getExternalPursuitCapacitySnapshot(): Promise<ExternalPursuitCapacitySnapshot> {
  const staff = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("external_pursuit_capacity_for_staff", {
    p_actor_user_id: staff.user.id,
  })
  if (error || !data) throw new Error(friendlyError(error, "Could not load External Pursuit capacity."))
  return data as ExternalPursuitCapacitySnapshot
}

/**
 * A normal edit never refreshes capacity evidence. The owner may confirm only
 * their own dossier; authorised staff may confirm any dossier. The browser is
 * responsible for retaining one exact key across an ambiguous network retry.
 */
export async function confirmExternalPursuitCurrent(
  pursuitId: string,
  idempotencyKey: string,
): Promise<ExternalPursuitConfirmationResult> {
  if (!isUuid(pursuitId) || !idempotencyKey.trim()) {
    return { success: false, outcome: "rejected", message: "External Pursuit confirmation is invalid." }
  }

  let access: Awaited<ReturnType<typeof getCurrentUserAccess>>
  try {
    access = await getCurrentUserAccess()
  } catch {
    // No mutation was attempted, so the browser may unlock this validation
    // failure rather than retaining a retry snapshot.
    return { success: false, outcome: "rejected", message: "External Pursuit access denied." }
  }
  if (!access || access.role === "unassigned" || (access.role === "repreneur" && !access.repreneurId)) {
    return { success: false, outcome: "rejected", message: "External Pursuit access denied." }
  }

  try {
    const { error, status } = await createAdminClient().rpc("confirm_external_pursuit_current", {
      p_dossier_id: pursuitId,
      p_actor_user_id: access.user.id,
      p_idempotency_key: idempotencyKey,
    })
    if (status === 0) {
      return { success: false, outcome: "ambiguous", message: "Confirmation result is unknown. Retry the same confirmation." }
    }
    if (error) {
      return { success: false, outcome: "rejected", message: friendlyError(error, "Could not confirm current status.") }
    }
  } catch {
    // A transport failure after dispatch has an ambiguous write outcome. The
    // client must keep the immutable dossier/key snapshot for an exact retry.
    return { success: false, outcome: "ambiguous", message: "Confirmation result is unknown. Retry the same confirmation." }
  }

  revalidatePath("/opportunities/pursuits/capacity")
  revalidatePath("/portal/pursuits")
  return { success: true, outcome: "confirmed", message: "Current status confirmed." }
}
