"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { startCriticalOperation } from "@/lib/observability/critical-operation"

export type MemoFeedbackChannel = "email" | "phone"
export type RecordMemoFeedbackResult =
  | { success: true; message: string; evidenceId: string }
  | { success: false; message: string }

/** Staff attests a substantive received response, not a memo view or note.
 * The displayed immutable grant ID is required for stale-page protection. */
export async function recordMemoFeedback(input: {
  matchId: string
  grantEvidenceId: string
  channel: MemoFeedbackChannel
  receivedAt: string
}): Promise<RecordMemoFeedbackResult> {
  const staff = await requireStaffAccess()
  const trace = startCriticalOperation("pursuit.journey_action")
  const receivedAt = new Date(input.receivedAt)
  if (!input.matchId || !input.grantEvidenceId
    || (input.channel !== "email" && input.channel !== "phone")
    || !Number.isFinite(receivedAt.getTime())) {
    trace.failure("validation_failed")
    return { success: false, message: "Choose email or phone and a valid Paris receipt time." }
  }
  const db = createAdminClient()
  const { data, error } = await db.rpc("w174_record_memo_feedback", {
    p_match_id: input.matchId,
    p_grant_evidence_id: input.grantEvidenceId,
    p_actor: staff.user.email,
    p_channel: input.channel,
    p_received_at: receivedAt.toISOString(),
  })
  if (error || typeof data !== "string") {
    const message = error?.message ?? ""
    if (message.includes("displayed memo grant is stale") || message.includes("feedback predates it")) {
      trace.failure("precondition_failed")
      return { success: false, message: "This memo grant changed or the receipt predates it. Refresh the pursuit before recording." }
    }
    if (message.includes("Feedback already recorded")) {
      trace.failure("precondition_failed")
      return { success: false, message: "Feedback is already recorded for this exact grant. Refresh to view the immutable receipt." }
    }
    if (message.includes("Record an actual email or phone receipt time")) {
      trace.failure("validation_failed")
      return { success: false, message: "Record an actual email or phone receipt time after this exact grant." }
    }
    if (message.includes("Exact staff authority is required")) {
      trace.failure("authorization_denied")
      return { success: false, message: "Staff access is required to record memo feedback." }
    }
    trace.failure("persistence_failed")
    return { success: false, message: "Could not record the exact memo feedback receipt." }
  }
  const { data: reminder, error: statusError } = await db
    .from("opportunity_memo_feedback_reminders")
    .select("status")
    .eq("grant_evidence_id", input.grantEvidenceId)
    .maybeSingle()
  trace.success()
  const suffix = statusError ? " Reminder delivery status is not confirmed; check the pursuit activity."
    : !reminder ? " No new reminder was scheduled for this historical grant."
    : reminder.status === "sent" ? " The reminder had already been sent."
    : reminder.status === "review_required" ? " Reminder delivery needs staff review because a provider attempt may already have started."
    : reminder.status === "suppressed" ? " The unsent reminder was cancelled."
    : " Check the current reminder delivery status."
  return { success: true, message: `Feedback received by ${input.channel} recorded for this exact grant.${suffix}`, evidenceId: data }
}
