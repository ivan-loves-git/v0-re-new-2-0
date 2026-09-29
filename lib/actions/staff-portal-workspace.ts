"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"

/** Explicitly select one repreneur in one staff browser workspace. */
export async function selectStaffPortalWorkspace(ownerId: string, currentToken: string | null) {
  const access = await requireStaffAccess()
  if (!isUuid(ownerId)) throw new Error("Select a valid repreneur.")
  const current = currentToken
    ? await verifyStaffPortalSelection(currentToken, ownerFromToken(currentToken), access.user.id)
    : null
  if (currentToken && !current) throw new Error("This staff workspace changed. Refresh before selecting another repreneur.")
  const { data, error } = await createAdminClient().rpc("w196_select_staff_portal_workspace", {
    p_workspace_id: current?.workspaceId ?? null,
    p_repreneur_id: ownerId,
    p_staff_user_id: access.user.id,
    p_staff_email: access.user.email,
  })
  if (error || !data || typeof data.workspaceId !== "string") {
    throw new Error("The selected staff workspace could not be saved. Refresh and try again.")
  }
  return { workspaceId: data.workspaceId as string }
}

function ownerFromToken(token: string) {
  // The caller cannot supply a trusted owner for a switch. Decode only to
  // identify what the signed/current verification must check.
  const payload = token.split(".")[0]
  try {
    const candidate = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { ownerId?: string }
    return isUuid(candidate.ownerId ?? "") ? candidate.ownerId! : ""
  } catch { return "" }
}
