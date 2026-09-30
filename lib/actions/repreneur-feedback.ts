"use server"

import { revalidatePath } from "next/cache"
import { requirePortalAccess, requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { isUuid } from "@/lib/uuid"
import {
  feedbackStatuses,
  validateFeedbackSubmission,
  type FeedbackStatus,
} from "@/lib/repreneur-feedback/validation"

export type SubmitFeedbackResult = { ok: true } | { ok: false; message: string }
export type StaffFeedbackResult = { ok: true } | { ok: false; message: string }

export async function submitRepreneurFeedback(input: unknown): Promise<SubmitFeedbackResult> {
  const access = await requirePortalAccess()
  if (access.role !== "repreneur" || !access.repreneurId) {
    return { ok: false, message: "Your repreneur access is unavailable. Sign in again." }
  }
  const parsed = validateFeedbackSubmission(input)
  if (!parsed.ok) return parsed

  const { error } = await createAdminClient().from("repreneur_feedback").insert({
    sender_user_id: access.user.id,
    sender_repreneur_id: access.repreneurId,
    category: parsed.value.category,
    message: parsed.value.message,
    context_key: parsed.value.context,
  })
  if (error) {
    return { ok: false, message: "Your feedback could not be saved. Please try again." }
  }
  // Return no row ID or stored content; repreneurs cannot read the queue.
  return { ok: true }
}

type StaffAction = "status" | "redact" | "delete"

async function mutateFeedback(input: {
  id: string
  expectedVersion: number
  action: StaffAction
  status?: FeedbackStatus
}): Promise<StaffFeedbackResult> {
  const staff = await requireStaffAccess()
  if (!isUuid(input.id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1
    || (input.action === "status" && !feedbackStatuses.includes(input.status as FeedbackStatus))
    || (input.action !== "status" && input.status !== undefined)) {
    return { ok: false, message: "This feedback action is invalid. Refresh and try again." }
  }

  const { data, error } = await createAdminClient().rpc("staff_mutate_repreneur_feedback", {
    p_id: input.id,
    p_expected_version: input.expectedVersion,
    p_action: input.action,
    p_new_status: input.action === "status" ? input.status : null,
    p_actor_user_id: staff.user.id,
    p_actor_email: staff.user.email,
  })
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "This feedback action could not be saved. Refresh and try again." }
  }
  if (data.outcome !== "updated" && data.outcome !== "deleted") {
    return { ok: false, message: "This feedback changed or expired. Refresh before trying again." }
  }
  revalidatePath("/tools/feedback")
  return { ok: true }
}

export async function setRepreneurFeedbackStatus(input: {
  id: string; expectedVersion: number; status: FeedbackStatus
}): Promise<StaffFeedbackResult> {
  return mutateFeedback({ ...input, action: "status" })
}

export async function redactRepreneurFeedback(input: {
  id: string; expectedVersion: number
}): Promise<StaffFeedbackResult> {
  return mutateFeedback({ ...input, action: "redact" })
}

export async function deleteRepreneurFeedback(input: {
  id: string; expectedVersion: number
}): Promise<StaffFeedbackResult> {
  return mutateFeedback({ ...input, action: "delete" })
}
