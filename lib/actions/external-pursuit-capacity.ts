"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ExternalPursuitCapacitySnapshot } from "@/lib/types/external-pursuit-capacity"

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

/** A normal edit never refreshes capacity evidence. Staff must make this explicit action. */
export async function confirmExternalPursuitCurrent(
  pursuitId: string,
  idempotencyKey: string = randomUUID(),
): Promise<{ success: boolean; message: string }> {
  if (!isUuid(pursuitId)) return { success: false, message: "External Pursuit not found." }
  try {
    const staff = await requireStaffAccess()
    const { error } = await createAdminClient().rpc("confirm_external_pursuit_current", {
      p_dossier_id: pursuitId,
      p_actor_user_id: staff.user.id,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return { success: false, message: friendlyError(error, "Could not confirm current status.") }
    revalidatePath("/opportunities/pursuits/capacity")
    return { success: true, message: "Current status confirmed." }
  } catch (error) {
    return { success: false, message: friendlyError(error, "Could not confirm current status.") }
  }
}
