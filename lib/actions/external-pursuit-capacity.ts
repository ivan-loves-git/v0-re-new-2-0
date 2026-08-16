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

// Only errors raised by the confirmation contract itself are a trustworthy
// negative result. A gateway/PostgREST error can arrive after PostgreSQL has
// committed the mutation, so the browser must retain its exact retry key.
const CONFIRMATION_DOMAIN_REJECTIONS = [
  "External Pursuit access denied.",
  "An actor and idempotency key are required.",
  "External Pursuit confirmation idempotency conflict.",
  "External Pursuit is not open capacity.",
] as const

function confirmationDomainRejection(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : ""
  return CONFIRMATION_DOMAIN_REJECTIONS.find((candidate) => message.includes(candidate)) ?? null
}

function ambiguousConfirmationResult(): ExternalPursuitConfirmationResult {
  return {
    success: false,
    outcome: "ambiguous",
    message: "Confirmation result is unknown. Retry the same confirmation.",
  }
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
    // A void RPC legitimately returns no data, but it must still return a
    // concrete HTTP receipt. Missing/status-0 responses are ambiguous.
    if (typeof status !== "number" || status === 0) return ambiguousConfirmationResult()
    if (error) {
      const rejection = confirmationDomainRejection(error)
      return rejection
        ? { success: false, outcome: "rejected", message: rejection }
        : ambiguousConfirmationResult()
    }
  } catch {
    // A transport failure after dispatch has an ambiguous write outcome. The
    // client must keep the immutable dossier/key snapshot for an exact retry.
    return ambiguousConfirmationResult()
  }

  revalidatePath("/opportunities/pursuits/capacity")
  revalidatePath("/portal/pursuits")
  return { success: true, outcome: "confirmed", message: "Current status confirmed." }
}
