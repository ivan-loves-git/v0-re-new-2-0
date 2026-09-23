import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"

export type StaffPortalSelection = {
  workspaceId: string
  generation: string
  ownerId: string
  staffUserId: string
  expiresAt: number
}

function signature(payload: string) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update("staff-portal-selection:v1:").update(payload).digest("base64url")
}

/** Bound to the logged-in staff actor, one selected owner and a short session. */
export function issueStaffPortalSelection(ownerId: string, staffUserId: string, workspaceId: string, generation: string) {
  if (!isUuid(ownerId) || !isUuid(workspaceId) || !isUuid(generation) || !staffUserId) throw new Error("Invalid staff portal selection")
  const payload = Buffer.from(JSON.stringify({ workspaceId, generation, ownerId, staffUserId, expiresAt: Date.now() + 30 * 60_000 } satisfies StaffPortalSelection)).toString("base64url")
  return `${payload}.${signature(payload)}`
}

export function parseStaffPortalSelection(token: string, ownerId: string, staffUserId: string): StaffPortalSelection | null {
  const [payload, mac, extra] = token.split(".")
  if (!payload || !mac || extra || payload.length > 1024 || mac.length > 128) return null
  const expected = signature(payload)
  const actualBytes = Buffer.from(mac)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StaffPortalSelection
    return value.ownerId === ownerId && value.staffUserId === staffUserId
      && isUuid(value.workspaceId) && isUuid(value.generation)
      && Number.isSafeInteger(value.expiresAt) && value.expiresAt > Date.now() ? value : null
  } catch { return null }
}

export async function verifyStaffPortalSelection(token: string, ownerId: string, staffUserId: string) {
  const selection = parseStaffPortalSelection(token, ownerId, staffUserId)
  if (!selection) return null
  const { data, error } = await createAdminClient().from("staff_portal_workspaces")
    .select("selected_repreneur_id,generation,staff_user_id")
    .eq("id", selection.workspaceId).maybeSingle()
  if (error || !data || data.selected_repreneur_id !== ownerId
    || data.generation !== selection.generation || data.staff_user_id !== staffUserId) return null
  return selection
}

export async function currentStaffPortalSelectionToken(workspaceId: string | undefined, ownerId: string, staffUserId: string) {
  if (!workspaceId || !isUuid(workspaceId)) return null
  const { data, error } = await createAdminClient().from("staff_portal_workspaces")
    .select("selected_repreneur_id,generation,staff_user_id")
    .eq("id", workspaceId).maybeSingle()
  if (error || !data || data.selected_repreneur_id !== ownerId || data.staff_user_id !== staffUserId) return null
  return issueStaffPortalSelection(ownerId, staffUserId, workspaceId, data.generation)
}
