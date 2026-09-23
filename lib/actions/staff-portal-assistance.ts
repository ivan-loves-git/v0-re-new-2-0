"use server"

import { revalidatePath } from "next/cache"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import { verifyStaffPortalSelection } from "@/lib/staff-portal-selection"
import type { OpportunityDeclineReasonCategory } from "@/lib/types/opportunity"

const DECLINE_REASONS = new Set<OpportunityDeclineReasonCategory>([
  "geography", "sector", "size_metrics", "business_model", "other",
])

export type StaffOpportunityResponseInput = {
  selectionToken: string
  repreneurId: string
  opportunityId: string
  matchId: string | null
  expectedOpportunityUpdatedAt: string
  expectedMatchUpdatedAt: string | null
  expectedInterestAt: string | null
  response: "interested" | "declined"
  declineReasonCategories: OpportunityDeclineReasonCategory[]
  declineReasonText: string | null
  operationKey: string
}

export async function recordStaffPortalOpportunityResponse(input: StaffOpportunityResponseInput) {
  const access = await requireStaffAccess()
  const selection = await verifyStaffPortalSelection(input.selectionToken, input.repreneurId, access.user.id)
  if (!selection) throw new Error("The selected staff workspace changed. Refresh and try again.")
  if (!isUuid(input.repreneurId) || !isUuid(input.opportunityId)
    || (input.matchId !== null && !isUuid(input.matchId)) || !isUuid(input.operationKey)
    || !Number.isFinite(Date.parse(input.expectedOpportunityUpdatedAt))
    || (input.expectedMatchUpdatedAt !== null && !Number.isFinite(Date.parse(input.expectedMatchUpdatedAt)))
    || (input.expectedInterestAt !== null && !Number.isFinite(Date.parse(input.expectedInterestAt)))
    || !["interested", "declined"].includes(input.response)) {
    throw new Error("The selected opportunity is invalid. Refresh and try again.")
  }
  if (input.response === "declined" && (!input.matchId
    || !input.declineReasonCategories.length
    || !input.declineReasonCategories.every((reason) => DECLINE_REASONS.has(reason))
    || !input.declineReasonText?.trim()
    || input.declineReasonText.length > 2000)) {
    throw new Error("Select a reason and enter a short rationale before declining.")
  }
  const supabase = createAdminClient()
  const { error } = await supabase.rpc("w196_record_staff_opportunity_response", {
    p_repreneur_id: input.repreneurId,
    p_opportunity_id: input.opportunityId,
    p_match_id: input.matchId,
    p_expected_opportunity_updated_at: input.expectedOpportunityUpdatedAt,
    p_expected_match_updated_at: input.expectedMatchUpdatedAt,
    p_expected_interest_at: input.expectedInterestAt,
    p_response: input.response,
    p_decline_reason_categories: input.response === "declined" ? input.declineReasonCategories : [],
    p_decline_reason_text: input.response === "declined" ? input.declineReasonText?.trim() : null,
    p_staff_user_id: access.user.id,
    p_staff_email: access.user.email,
    p_operation_key: input.operationKey,
    p_workspace_id: selection.workspaceId,
    p_workspace_generation: selection.generation,
  })
  if (error) throw new Error("The selection or response changed. Refresh this repreneur's preview and try again.")
  // No owner-response notification or owner-click email is delivered here.
  // The database status trigger still cancels any pending W175 response cycle.
  revalidatePath("/portal-preview")
  revalidatePath(`/repreneurs/${input.repreneurId}`)
}
