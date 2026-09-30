"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { listStaffEmailReviews, type StaffEmailReview } from "@/lib/actions/staff-email-review"
import { parseEmailReviewQueueOptions, emailReviewSearchPattern } from "@/lib/email/review-queue-query"
import { currentStaffEmailAttempt } from "@/lib/email/staff-email-attempt"
import { dispatchReservedStaffEmailReview } from "@/lib/email/staff-email-reserved-dispatch"
import { sendOpportunityFreshnessReview } from "@/lib/opportunity-freshness-send"
import { buildMaReviewedRequest, getMaReviewTemplateVersion } from "@/lib/ma-workflows"
import { fingerprintResendDeliveryRequest } from "@/lib/email/resend-delivery-outcome"
import { isUuid } from "@/lib/uuid"
import { revalidatePath } from "next/cache"

export interface BulkReviewSnapshot {
  id: string; version: number; source_kind: StaffEmailReview["source_kind"];
  source_operation_id: string; opportunity_id: string; match_id: string | null;
  upstream_evidence_id: string | null; contact_link_id: string | null;
  recipient_email: string; namespace: "REAL" | "DEMO"; template_key: string;
  template_version: string; subject: string; body_text: string;
  attachment_snapshot: StaffEmailReview["attachment_snapshot"];
}
export interface BulkEmailItem {
  batch_id: string; ordinal: number; review_id: string; review_snapshot: BulkReviewSnapshot;
  members_snapshot: Array<Record<string, unknown>>; snapshot_sha256: string;
  acknowledged_by: string | null; acknowledged_at: string | null;
  state: "not_attempted" | "started" | "accepted" | "blocked" | "failed" | "uncertain";
  started_at: string | null; finished_at: string | null; outcome_detail: string | null;
}
export interface BulkEmailBatch {
  id: string; prepared_by: string; prepared_at: string; confirmed_by: string | null;
  confirmed_at: string | null; item_count: number; page_query: Record<string, unknown>;
  manifest_sha256: string;
}

function requireBatchId(id: string) {
  if (!isUuid(id)) throw new Error("The bulk review link is invalid.")
}

async function readStaffBatch(id: string, actor: string) {
  requireBatchId(id)
  const db = createAdminClient()
  const [{ data: batch, error: batchError }, { data: items, error: itemsError }] = await Promise.all([
    db.from("staff_email_bulk_batches").select("*").eq("id", id).maybeSingle(),
    db.from("staff_email_bulk_items").select("batch_id,ordinal,review_id,review_snapshot,members_snapshot,snapshot_sha256,acknowledged_by,acknowledged_at,state,started_at,finished_at,outcome_detail")
      .eq("batch_id", id).order("ordinal"),
  ])
  if (batchError || itemsError || !batch || batch.prepared_by !== actor) {
    throw new Error("This staff batch is unavailable to the current preparer.")
  }
  return { batch: batch as BulkEmailBatch, items: (items ?? []) as BulkEmailItem[] }
}

export async function getStaffEmailBulk(id: string) {
  const { user } = await requireStaffAccess()
  return readStaffBatch(id, user.id)
}

export async function prepareStaffEmailBulk(input: {
  ids: Array<{ id: string; version: number }>;
  page: number; view: string; search: string; purpose: string; sort: string; direction: string;
}) {
  const { user } = await requireStaffAccess()
  if (!Array.isArray(input.ids) || input.ids.length < 1 || input.ids.length > 5 ||
    input.ids.some((item) => !item || !isUuid(item.id) || !Number.isSafeInteger(item.version) || item.version < 1) ||
    new Set(input.ids.map((item) => item.id)).size !== input.ids.length) {
    throw new Error("Choose one to five distinct, unattempted REAL drafts from this page.")
  }
  const options = parseEmailReviewQueueOptions({
    reviewPage: String(input.page), reviewFilter: input.view, reviewSearch: input.search,
    reviewPurpose: input.purpose, reviewSort: input.sort, reviewDirection: input.direction,
  })
  if (options.page !== input.page || options.view !== input.view || options.search !== input.search ||
    options.purpose !== input.purpose || options.sort !== input.sort || options.direction !== input.direction) {
    throw new Error("The queue query changed. Refresh and select this page again.")
  }
  const queue = await listStaffEmailReviews(options)
  if (queue.page !== input.page || input.ids.some((item) => !queue.reviews.some((row) =>
    row.id === item.id && row.version === item.version && row.state === "pending" &&
    row.namespace === "REAL" && row.archived_at === null))) {
    throw new Error("A selected message left this current page or changed. Refresh before preparing.")
  }
  const { data, error } = await createAdminClient().rpc("staff_email_bulk_prepare", {
    p_review_ids: input.ids.map((item) => item.id), p_versions: input.ids.map((item) => item.version),
    p_page: input.page, p_view: input.view,
    p_search_pattern: input.search ? emailReviewSearchPattern(input.search) : "%",
    p_purpose: input.purpose, p_sort: input.sort, p_direction: input.direction, p_actor: user.id,
  })
  if (error || typeof data !== "string") {
    throw new Error("The current page or a source draft changed. Refresh and prepare the selection again.")
  }
  revalidatePath("/emails")
  return { batchId: data, href: `/emails/bulk/${encodeURIComponent(data)}` }
}

export async function acknowledgeStaffEmailBulkItem(batchId: string, ordinal: number, snapshotSha256: string) {
  const { user } = await requireStaffAccess()
  requireBatchId(batchId)
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 5 || !/^[0-9a-f]{64}$/.test(snapshotSha256)) {
    throw new Error("Choose the exact reviewed message to acknowledge.")
  }
  const { error } = await createAdminClient().rpc("staff_email_bulk_ack", {
    p_batch_id: batchId, p_ordinal: ordinal, p_snapshot_sha256: snapshotSha256, p_actor: user.id,
  })
  if (error) throw new Error("This message changed or the batch belongs to another staff member. Reload before confirming.")
  revalidatePath(`/emails/bulk/${batchId}`)
  return { success: true as const }
}

export async function confirmStaffEmailBulk(batchId: string, manifestSha256: string) {
  const { user } = await requireStaffAccess()
  requireBatchId(batchId)
  if (!/^[0-9a-f]{64}$/.test(manifestSha256)) throw new Error("Reload the exact batch manifest.")
  const { error } = await createAdminClient().rpc("staff_email_bulk_confirm", {
    p_batch_id: batchId, p_manifest_sha256: manifestSha256, p_actor: user.id,
  })
  if (error) throw new Error("Every complete message must be acknowledged by its preparer and remain unchanged. Reload this batch.")
  revalidatePath(`/emails/bulk/${batchId}`)
  return { success: true as const }
}

async function readCurrentReview(id: string): Promise<StaffEmailReview> {
  const { data, error } = await createAdminClient().from("staff_email_reviews").select("*").eq("id", id).maybeSingle()
  if (error || !data) throw new Error("The selected review no longer exists.")
  return data as StaffEmailReview
}

async function currentBulkAttempt(review: StaffEmailReview) {
  if (review.source_kind !== "freshness") return currentStaffEmailAttempt(review)
  if (process.env.OPPORTUNITY_FRESHNESS_DISPATCH_ENABLED === "false") {
    throw new Error("Grouped freshness sending is temporarily disabled.")
  }
  if (review.namespace !== "REAL") throw new Error("DEMO freshness cannot be sent.")
  const templateVersion = await getMaReviewTemplateVersion("ma_opportunity_validity_check", true)
  if (templateVersion !== review.template_version) throw new Error("The catalogue copy changed. Refresh this group.")
  const { error } = await createAdminClient().rpc("opportunity_freshness_assert_current", { p_review_id: review.id })
  if (error) throw new Error("A grouped member or recipient changed. Refresh this group.")
  const payload = buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email)
  return { payload, fingerprint: fingerprintResendDeliveryRequest(payload, `freshness:${review.id}`) }
}

export async function dispatchStaffEmailBulkItem(batchId: string, ordinal: number) {
  const { user } = await requireStaffAccess()
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 5) throw new Error("Choose one message in the confirmed batch.")
  const { batch, items } = await readStaffBatch(batchId, user.id)
  const item = items.find((row) => row.ordinal === ordinal)
  if (!item || batch.confirmed_by !== user.id) throw new Error("This batch has not been confirmed by its preparer.")
  if (item.state !== "not_attempted") return { state: item.state, message: "This message was already claimed. Read its individual status; no second send was started." }

  let review: StaffEmailReview
  let attempt: Awaited<ReturnType<typeof currentBulkAttempt>>
  try {
    review = await readCurrentReview(item.review_id)
    if (review.version !== item.review_snapshot.version || review.state !== "pending" || review.archived_at ||
      review.attempted_payload || review.attempted_at || review.namespace !== "REAL") {
      throw new Error("The exact reviewed message changed before delivery.")
    }
    attempt = await currentBulkAttempt(review)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The current delivery gate is unavailable."
    const { error } = await createAdminClient().rpc("staff_email_bulk_block", {
      p_batch_id: batchId, p_ordinal: ordinal, p_actor: user.id, p_reason: message,
    })
    if (error) return { state: "uncertain" as const, message: "The item changed concurrently. Inspect its current status; no batch retry was started." }
    revalidatePath(`/emails/bulk/${batchId}`)
    return { state: "blocked" as const, message }
  }

  const db = createAdminClient()
  const { data: claim, error: claimError } = await db.rpc("staff_email_bulk_claim", {
    p_batch_id: batchId, p_ordinal: ordinal, p_actor: user.id,
    p_payload: attempt.payload, p_fingerprint: attempt.fingerprint,
  })
  if (claimError || !claim) {
    const { error } = await db.rpc("staff_email_bulk_block", {
      p_batch_id: batchId, p_ordinal: ordinal, p_actor: user.id,
      p_reason: "The exact current source reservation or review version was unavailable before provider I/O.",
    })
    if (error) return { state: "uncertain" as const, message: "Another request may have claimed this item. Inspect its current status; no batch retry was started." }
    revalidatePath(`/emails/bulk/${batchId}`)
    return { state: "blocked" as const, message: "The source or review changed before delivery. No provider call was made." }
  }
  if (claim.start !== true) {
    return { state: String(claim.state), message: "This item was already claimed. No second provider call was made." }
  }
  if (typeof claim.claim_token !== "string" || typeof claim.review_attempt_token !== "string") {
    return { state: "uncertain" as const, message: "The claim response was incomplete. Inspect the individual review; no batch retry is allowed." }
  }
  let result: { state: "sent" | "failed" | "uncertain"; message: string; blockedBeforeIo?: boolean }
  try {
    if (review.source_kind === "freshness") {
      result = await sendOpportunityFreshnessReview(review, review.version, user.id, claim.review_attempt_token)
    } else {
      result = await dispatchReservedStaffEmailReview(review, user.id, claim.review_attempt_token, {
        maReservationToken: typeof claim.ma_reservation_token === "string" ? claim.ma_reservation_token : undefined,
        handoffAttempt: typeof claim.handoff_delivery_id === "string" && typeof claim.handoff_operation_key === "string"
          ? { delivery_id: claim.handoff_delivery_id, operation_key: claim.handoff_operation_key,
              delivery_status: "sending", evidence_id: null } : undefined,
      })
    }
  } catch {
    result = { state: "uncertain", message: "Delivery or finalization may have occurred. Inspect the individual review and source receipt; this batch will not retry it." }
  }
  const outcome = result.blockedBeforeIo ? "blocked" : result.state === "sent" ? "accepted" : result.state
  const { error: finishError } = await db.rpc("staff_email_bulk_finish", {
    p_batch_id: batchId, p_ordinal: ordinal, p_claim_token: claim.claim_token,
    p_outcome: outcome, p_detail: result.message, p_actor: user.id,
  })
  revalidatePath(`/emails/bulk/${batchId}`); revalidatePath("/emails")
  if (finishError) return { state: "uncertain" as const,
    message: "The provider or source may have completed, but the batch outcome could not be finalized. Reconcile receipts before proceeding." }
  return { state: outcome, message: result.message }
}

export async function reconcileStaffEmailBulkItem(batchId: string, ordinal: number) {
  const { user } = await requireStaffAccess()
  requireBatchId(batchId)
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 5) throw new Error("Choose a valid batch item.")
  const { data, error } = await createAdminClient().rpc("staff_email_bulk_reconcile", {
    p_batch_id: batchId, p_ordinal: ordinal, p_actor: user.id,
  })
  if (error || typeof data !== "string") throw new Error("The individual source receipt could not be reconciled. No send was started.")
  revalidatePath(`/emails/bulk/${batchId}`)
  return { state: data, message: data === "uncertain" ? "Outcome remains unknown; only individual receipt reconciliation can resolve it." : "Current source receipt read. No email was sent by this check." }
}
