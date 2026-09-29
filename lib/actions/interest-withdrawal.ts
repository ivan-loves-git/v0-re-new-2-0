"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import { isUuid } from "@/lib/uuid"
import { interestWithdrawalOperationsPaused } from "@/lib/interest-withdrawal-operations"

export type InterestWithdrawalResult = { ok: true; message: string } | { ok: false; message: string }

function validTarget(matchId: string, opportunityId: string, interestAt: string, updatedAt: string, reason: string) {
  return isUuid(matchId) && isUuid(opportunityId)
    && Number.isFinite(Date.parse(interestAt)) && Number.isFinite(Date.parse(updatedAt))
    && reason.trim().length > 0 && reason.trim().length <= 500
}

function refresh(matchId: string, opportunityId: string, repreneurId: string) {
  revalidatePath("/portal/deals")
  revalidatePath(`/portal/deals/${matchId}`)
  revalidatePath("/opportunities/reviews")
  revalidatePath(`/opportunities/${opportunityId}`)
  revalidatePath("/portal-preview")
  revalidatePath(`/repreneurs/${repreneurId}`)
}

function withdrawalFailure(message?: string): InterestWithdrawalResult {
  if (message?.includes("withdrawal_requires_staff_drop")) {
    return { ok: false, message: "Re-New has already validated this pursuit. Contact the team to use the normal Drop process." }
  }
  if (message?.includes("withdrawal_interest_stale") || message?.includes("staff_portal_selection_changed")) {
    return { ok: false, message: "This exact interest or selected workspace has changed. Refresh the page before taking action." }
  }
  if (message?.includes("withdrawal_actor_denied")) {
    return { ok: false, message: "This account cannot withdraw that repreneur's interest." }
  }
  return { ok: false, message: "The withdrawal could not be confirmed right now. Please try again." }
}

export async function withdrawMyOpportunityInterest(
  matchId: string, opportunityId: string, interestAt: string, updatedAt: string, reason: string,
): Promise<InterestWithdrawalResult> {
  const access = await requirePortalAccess()
  if (interestWithdrawalOperationsPaused()) return { ok: false, message: "Interest withdrawal is temporarily paused. Contact Re-New for help." }
  if (!access.repreneurId || !validTarget(matchId, opportunityId, interestAt, updatedAt, reason)) {
    return withdrawalFailure()
  }
  const { data, error } = await createAdminClient().rpc("w192_withdraw_exact_interest", {
    p_match_id: matchId,
    p_opportunity_id: opportunityId,
    p_repreneur_id: access.repreneurId,
    p_actor_id: access.user.id,
    p_actor_email: access.user.email,
    p_expected_interest_at: interestAt,
    p_expected_updated_at: updatedAt,
    p_reason: reason.trim(),
  })
  if (error || data?.status !== "withdrawn") return withdrawalFailure(error?.message)
  refresh(matchId, opportunityId, access.repreneurId)
  return { ok: true, message: "Your interest was withdrawn before Re-New validation. This opportunity remains available if eligible." }
}

export async function withdrawStaffPortalOpportunityInterest(input: {
  selectionToken: string
  repreneurId: string
  opportunityId: string
  matchId: string
  expectedInterestAt: string
  expectedUpdatedAt: string
  reason: string
}): Promise<InterestWithdrawalResult> {
  const access = await requireStaffAccess()
  if (interestWithdrawalOperationsPaused()) return { ok: false, message: "Interest withdrawal is temporarily paused. Contact Re-New for help." }
  if (!isUuid(input.repreneurId) || !validTarget(input.matchId, input.opportunityId,
    input.expectedInterestAt, input.expectedUpdatedAt, input.reason)) return withdrawalFailure()
  const selection = await verifyStaffPortalSelection(input.selectionToken, input.repreneurId, access.user.id)
  if (!selection) return { ok: false, message: "The selected staff workspace changed. Refresh and try again." }
  const { data, error } = await createAdminClient().rpc("w192_withdraw_exact_interest", {
    p_match_id: input.matchId,
    p_opportunity_id: input.opportunityId,
    p_repreneur_id: input.repreneurId,
    p_actor_id: access.user.id,
    p_actor_email: access.user.email,
    p_expected_interest_at: input.expectedInterestAt,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_reason: input.reason.trim(),
    p_workspace_id: selection.workspaceId,
    p_workspace_generation: selection.generation,
  })
  if (error || data?.status !== "withdrawn") return withdrawalFailure(error?.message)
  refresh(input.matchId, input.opportunityId, input.repreneurId)
  return { ok: true, message: "Interest withdrawn by Re-New staff on this repreneur's behalf. The actual staff actor was recorded." }
}
