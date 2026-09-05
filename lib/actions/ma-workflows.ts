"use server"

import { requireStaffAccess } from "@/lib/access-control"
import * as workflow from "@/lib/ma-workflows"
export type { MaEmailSendResult, MaWorkflowDraft, MaWorkflowContact, MaOpportunityWorkflow } from "@/lib/ma-workflows"

export async function getMaOpportunityWorkflow(opportunityId: string) {
  await requireStaffAccess()
  return workflow.getMaOpportunityWorkflow(opportunityId)
}
export async function sendMaSourceWorkflowEmail(opportunityId: string, formData: FormData) {
  await requireStaffAccess()
  return workflow.sendMaSourceWorkflowEmail(opportunityId, formData)
}
// Public staff action remains body-only. Private NDA bytes can be supplied only
// by the server-only pursuit delivery path after its exact Gate 2 checks.
export async function sendMaSourceWorkflowEmailPayload(opportunityId: string, payload: {
  templateKey: string | null; subject: string | null; body: string | null;
  contactId?: string | null; clientOperationKey: string | null
}) {
  await requireStaffAccess()
  return workflow.sendMaSourceWorkflowEmailPayload(opportunityId, payload)
}
