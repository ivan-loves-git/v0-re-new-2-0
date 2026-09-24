"use server"

import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMaReviewContext, getMaReviewTemplateVersion, renderMaWorkflowContent, buildMaReviewedRequest, sendMaSourceWorkflowEmailPayload } from "@/lib/ma-workflows"
import { preparePursuitHandoff } from "@/lib/pursuit-handoff-delivery"
import { fixedIntermediaryHandoffCopy, buildPursuitNdaReadyRequest } from "@/lib/pursuit-handoff-copy"
import { sendPursuitIntermediaryHandoff, sendPursuitNdaReadyNotice } from "@/lib/actions/opportunity-pursuit-handoffs"
import { sameAttachmentSnapshot } from "@/lib/staff-email-review-guard"
import { isUuid } from "@/lib/uuid"
import { revalidatePath } from "next/cache"

const MA_KEYS = new Set([
  "ma_opportunity_validity_check", "ma_request_more_information", "ma_repreneur_interest_feedback",
  "ma_nda_info_memo_request", "ma_process_follow_up",
])
type SourceKind = "ma" | "e4" | "e6" | "e7"

export interface StaffEmailReview {
  id: string; source_kind: SourceKind; source_operation_id: string; opportunity_id: string;
  match_id: string | null; upstream_evidence_id: string | null; contact_link_id: string | null;
  recipient_email: string; namespace: "REAL" | "DEMO"; template_key: string; template_version: string;
  subject: string; body_text: string; attachment_snapshot: Array<{ artifact_id: string; document_id: string; content_sha256: string; file_name: string; mime_type: string; size_bytes: number }>;
  state: "pending" | "sending" | "sent" | "failed" | "uncertain" | "cancelled"; version: number;
  created_by: string; created_at: string; edited_by: string | null; edited_at: string | null;
  approved_by: string | null; approved_at: string | null; attempted_at: string | null;
  outcome_at: string | null; provider_message_id: string | null; delivery_evidence_id: string | null;
  delivery_error: string | null; cancelled_by: string | null; cancelled_at: string | null; cancel_reason: string | null;
}

function requireId(id: string) {
  if (!isUuid(id)) throw new Error("Choose a valid review record.")
}

async function reviewById(id: string): Promise<StaffEmailReview> {
  requireId(id)
  const { data, error } = await createAdminClient().from("staff_email_reviews").select("*").eq("id", id).maybeSingle()
  if (error || !data) throw new Error("This review record is unavailable.")
  return data as StaffEmailReview
}

export async function listStaffEmailReviews(): Promise<StaffEmailReview[]> {
  await requireStaffAccess()
  const { data, error } = await createAdminClient().from("staff_email_reviews").select("*")
    .order("created_at", { ascending: false }).limit(50)
  if (error) throw new Error("The review queue is unavailable.")
  return (data ?? []) as StaffEmailReview[]
}

export async function getStaffEmailReview(id: string) {
  await requireStaffAccess()
  const review = await reviewById(id)
  const db = createAdminClient()
  const [{ data, error }, template] = await Promise.all([
    db.from("staff_email_review_events").select("id,event_kind,actor,occurred_at,version,detail")
      .eq("review_id", id).order("occurred_at", { ascending: true }).limit(100),
    review.source_kind === "e6" ? Promise.resolve({ data: { is_active: true }, error: null }) :
      db.from("email_templates").select("is_active").eq("template_key", review.template_key).maybeSingle(),
  ])
  if (error) throw new Error("The review history is unavailable.")
  return { review, events: data ?? [], catalogueEnabled: !template.error && template.data?.is_active === true }
}

async function persistPreparation(input: {
  sourceKind: SourceKind; sourceOperationId: string; opportunityId: string; matchId: string | null;
  upstreamId: string | null; contactLinkId: string | null; recipientEmail: string;
  namespace: "REAL" | "DEMO"; templateKey: string; templateVersion: string;
  subject: string; body: string; attachmentSnapshot: StaffEmailReview["attachment_snapshot"];
}) {
  const { user } = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("staff_email_review_prepare", {
    p_source_kind: input.sourceKind, p_source_operation_id: input.sourceOperationId,
    p_opportunity_id: input.opportunityId, p_match_id: input.matchId,
    p_upstream_evidence_id: input.upstreamId, p_contact_link_id: input.contactLinkId,
    p_recipient_email: input.recipientEmail, p_namespace: input.namespace,
    p_template_key: input.templateKey, p_template_version: input.templateVersion,
    p_subject: input.subject, p_body_text: input.body,
    p_attachment_snapshot: input.attachmentSnapshot, p_actor: user.id,
  })
  if (error?.message?.includes("staff_email_review_unresolved_source_blocks_new_draft")) {
    throw new Error("An earlier email for this opportunity is in flight or uncertain. Reopen that review; do not create a new draft to resend.")
  }
  if (error || typeof data !== "string") throw new Error("The review draft could not be saved safely.")
  revalidatePath("/emails")
  return { success: true as const, reviewId: data, message: "Draft prepared for staff review. Nothing was sent." }
}

export async function prepareMaEmailReview(input: {
  opportunityId: string; sourceOperationId: string; templateKey: string;
  contactLinkId: string; subject: string; body: string;
}) {
  await requireStaffAccess()
  requireId(input.opportunityId); requireId(input.sourceOperationId); requireId(input.contactLinkId)
  if (!MA_KEYS.has(input.templateKey) || !input.subject.trim() || !input.body.trim()) {
    throw new Error("Choose an existing M&A template and complete its subject and message.")
  }
  const context = await getMaReviewContext(input.opportunityId, input.contactLinkId)
  if (input.templateKey === "ma_nda_info_memo_request" && !context.activeMatchId) {
    throw new Error("Validate an active pursuit before preparing this NDA/memo request.")
  }
  const version = await getMaReviewTemplateVersion(input.templateKey, false)
  const content = await renderMaWorkflowContent(input.opportunityId, input.subject, input.body)
  return persistPreparation({ sourceKind: "ma", sourceOperationId: input.sourceOperationId,
    opportunityId: input.opportunityId, matchId: null, upstreamId: null,
    contactLinkId: context.contactLinkId, recipientEmail: context.recipientEmail,
    namespace: context.namespace, templateKey: input.templateKey, templateVersion: version,
    subject: content.subject, body: content.body, attachmentSnapshot: [],
  })
}

export async function preparePursuitEmailReview(matchId: string, type: "e4" | "e6" | "e7") {
  await requireStaffAccess()
  requireId(matchId)
  if (!["e4", "e6", "e7"].includes(type)) throw new Error("Choose an included pursuit handoff.")
  const { handoff, context } = await preparePursuitHandoff(createAdminClient(), matchId, type)
  if (type === "e6") {
    const request = buildPursuitNdaReadyRequest(matchId, context)
    return persistPreparation({ sourceKind: "e6", sourceOperationId: handoff.upstreamId,
      opportunityId: handoff.opportunityId, matchId, upstreamId: handoff.upstreamId,
      contactLinkId: null, recipientEmail: request.to[0],
      namespace: context.opportunity.is_demo ? "DEMO" : "REAL", templateKey: "code:e6_nda_ready",
      templateVersion: "w112-e6-v1", subject: request.subject, body: request.text, attachmentSnapshot: [],
    })
  }
  const blankPresent = context.upstream.metadata?.blank_nda_present_at_validation
  if (type === "e4" && typeof blankPresent !== "boolean") {
    throw new Error("This historical validation lacks a frozen NDA request. Revalidate the pursuit first.")
  }
  const ma = await getMaReviewContext(handoff.opportunityId)
  const copy = fixedIntermediaryHandoffCopy(type, Boolean(blankPresent))
  const rendered = await renderMaWorkflowContent(handoff.opportunityId, copy.subject, copy.body)
  await getMaReviewTemplateVersion("ma_nda_info_memo_request", false)
  return persistPreparation({ sourceKind: type, sourceOperationId: handoff.upstreamId,
    opportunityId: handoff.opportunityId, matchId, upstreamId: handoff.upstreamId,
    contactLinkId: ma.contactLinkId, recipientEmail: ma.recipientEmail,
    namespace: ma.namespace, templateKey: "ma_nda_info_memo_request", templateVersion: `w112-${type}-v1`,
    subject: rendered.subject, body: rendered.body, attachmentSnapshot: handoff.snapshot,
  })
}

export async function editStaffEmailReview(id: string, version: number, subject: string, body: string) {
  const { user } = await requireStaffAccess()
  requireId(id)
  const { error } = await createAdminClient().rpc("staff_email_review_edit", {
    p_review_id: id, p_version: version, p_subject: subject, p_body_text: body, p_actor: user.id,
  })
  if (error) throw new Error("The draft changed or cannot be edited. Refresh before trying again.")
  revalidatePath(`/emails/review/${id}`); revalidatePath("/emails")
  return { success: true as const, message: "Review text saved. The template was not changed." }
}

export async function cancelStaffEmailReview(id: string, version: number, reason: string) {
  const { user } = await requireStaffAccess()
  requireId(id)
  const { error } = await createAdminClient().rpc("staff_email_review_cancel", {
    p_review_id: id, p_version: version, p_reason: reason, p_actor: user.id,
  })
  if (error) throw new Error("This draft cannot be cancelled or its version changed. Refresh and inspect its delivery state.")
  revalidatePath(`/emails/review/${id}`); revalidatePath("/emails")
  return { success: true as const, message: "Draft cancelled with a retained reason." }
}

async function currentAttemptPayload(review: StaffEmailReview) {
  if (review.namespace !== "REAL") throw new Error("DEMO drafts cannot deliver from the production review queue.")
  let request: { from: string; to: string[]; subject: string; html: string; text: string }
  let attachments = review.attachment_snapshot
  if (review.source_kind === "ma" || review.source_kind === "e4" || review.source_kind === "e7") {
    const version = await getMaReviewTemplateVersion(review.template_key, true)
    if (review.source_kind === "ma" && version !== review.template_version) {
      throw new Error("The catalogue template changed after preparation. This draft cannot be sent.")
    }
    const ma = await getMaReviewContext(review.opportunity_id, review.contact_link_id)
    if (ma.namespace !== "REAL" || ma.recipientEmail.trim().toLowerCase() !== review.recipient_email.trim().toLowerCase()) {
      throw new Error("The canonical opportunity recipient changed after review. No email was sent.")
    }
    if (review.source_kind === "ma" && review.template_key === "ma_nda_info_memo_request" && !ma.activeMatchId) {
      throw new Error("The required active pursuit is no longer current.")
    }
    if (review.source_kind !== "ma") {
      if (!review.match_id) throw new Error("Pursuit identity is missing.")
      const { handoff, context } = await preparePursuitHandoff(createAdminClient(), review.match_id, review.source_kind)
      const blank = context.upstream.metadata?.blank_nda_present_at_validation
      if (review.source_kind === "e4" && typeof blank !== "boolean") throw new Error("The E4 validation no longer has its NDA request.")
      const copy = fixedIntermediaryHandoffCopy(review.source_kind, Boolean(blank))
      const rendered = await renderMaWorkflowContent(review.opportunity_id, copy.subject, copy.body)
      if (handoff.upstreamId !== review.source_operation_id || rendered.subject !== review.subject || rendered.body !== review.body_text ||
          review.template_version !== `w112-${review.source_kind}-v1` ||
          !sameAttachmentSnapshot(handoff.snapshot, review.attachment_snapshot)) {
        throw new Error("The handoff gate, fixed copy or signed PDFs changed after review.")
      }
      attachments = handoff.snapshot
    }
    request = buildMaReviewedRequest(review.subject, review.body_text, review.recipient_email)
  } else {
    if (!review.match_id) throw new Error("Pursuit identity is missing.")
    const { handoff, context } = await preparePursuitHandoff(createAdminClient(), review.match_id, "e6")
    const current = buildPursuitNdaReadyRequest(review.match_id, context)
    if (handoff.upstreamId !== review.source_operation_id || review.template_key !== "code:e6_nda_ready" || review.template_version !== "w112-e6-v1" ||
        current.to[0] !== review.recipient_email || current.subject !== review.subject || current.text !== review.body_text || context.opportunity.is_demo) {
      throw new Error("The NDA-ready gate, recipient or governed copy changed after review.")
    }
    request = current
  }
  return { ...request, attachments }
}

async function readSourceDeliveryOutcome(review: StaffEmailReview): Promise<{
  state: "sent" | "failed" | null; providerMessageId: string | null; evidenceId: string | null
}> {
  const db = createAdminClient()
  if (review.source_kind === "ma") {
    const { data, error } = await db.from("ma_interactions")
      .select("id,delivery_status,provider_message_id")
      .eq("client_operation_key", review.source_operation_id)
      .eq("opportunity_id", review.opportunity_id)
      .eq("template_key", review.template_key)
      .eq("recipient_email_snapshot", review.recipient_email)
      .eq("title", review.subject)
      .eq("body_markdown", review.body_text).maybeSingle()
    if (error || !data) return { state: null, providerMessageId: null, evidenceId: null }
    return { state: data.delivery_status === "sent" && data.provider_message_id ? "sent"
      : data.delivery_status === "failed" ? "failed" : null,
      providerMessageId: data.provider_message_id ?? null, evidenceId: data.id ?? null }
  }
  const { data, error } = await db.from("opportunity_pursuit_handoff_deliveries")
    .select("delivery_status,provider_message_id,evidence_id")
    .eq("upstream_evidence_id", review.source_operation_id)
    .eq("match_id", review.match_id)
    .eq("handoff_type", review.source_kind).maybeSingle()
  if (error || !data) return { state: null, providerMessageId: null, evidenceId: null }
  return { state: data.delivery_status === "sent" && data.provider_message_id && data.evidence_id ? "sent"
    : data.delivery_status === "failed" ? "failed" : null,
    providerMessageId: data.provider_message_id ?? null, evidenceId: data.evidence_id ?? null }
}

export async function approveAndSendStaffEmailReview(id: string, version: number) {
  const { user } = await requireStaffAccess()
  const review = await reviewById(id)
  if (review.version !== version) throw new Error("This review changed. Refresh before approving its exact version.")
  const payload = await currentAttemptPayload(review)
  const db = createAdminClient()
  const { data: token, error: reserveError } = await db.rpc("staff_email_review_reserve", {
    p_review_id: id, p_version: version, p_payload: payload, p_actor: user.id,
  })
  if (reserveError || typeof token !== "string") {
    throw new Error(reserveError?.message?.includes("reconciliation_required")
      ? review.state === "failed"
        ? "This failed handoff's unchanged retry window expired. Reconcile the source record; do not mint a replacement operation."
        : "This earlier outcome is uncertain and its safe replay window expired. Reconcile it; do not resend."
      : "This review is stale, in flight or blocked by another uncertain send. Refresh its state.")
  }

  // Reservation preserves the first approving actor for the older M&A RPC's
  // same-actor replay constraint; the queue event records every actual caller.
  const reserved = await reviewById(id)
  let result: { success: boolean; message: string; operationState?: "pending" | "failed" | "sent"; eventId?: string }
  try {
    if (review.source_kind === "ma") {
      result = await sendMaSourceWorkflowEmailPayload(review.opportunity_id, {
        templateKey: review.template_key, subject: review.subject, body: review.body_text,
        contactId: review.contact_link_id, clientOperationKey: review.source_operation_id,
      }, undefined, { recipientEmail: review.recipient_email, templateVersion: review.template_version, actorId: reserved.approved_by! })
    } else if (review.source_kind === "e6") {
      result = await sendPursuitNdaReadyNotice(review.match_id!, id)
    } else {
      result = await sendPursuitIntermediaryHandoff(review.match_id!, review.source_kind, id)
    }
  } catch (error) {
    result = { success: false, operationState: "pending", message: error instanceof Error ? error.message : "The delivery result is uncertain." }
  }
  const priorOutcomeUnknown = review.state === "uncertain" || review.state === "sending"
  let source: Awaited<ReturnType<typeof readSourceDeliveryOutcome>> | null = null
  if (result.success || priorOutcomeUnknown) {
    try { source = await readSourceDeliveryOutcome(review) }
    catch { /* Unreadable evidence is unknown, never a conclusive failure. */ }
  }
  // A later pre-I/O veto cannot erase an earlier unknown provider outcome.
  // Only the source's finalized operation record can resolve it.
  let state: "sent" | "uncertain" | "failed" = source?.state === "sent" ? "sent"
    : priorOutcomeUnknown ? source?.state === "failed" ? "failed" : "uncertain"
    : result.success || result.operationState === "pending" || result.operationState === "sent" ? "uncertain" : "failed"
  if (result.success && source?.state !== "sent") state = "uncertain"
  const providerMessageId = state === "sent" ? source?.providerMessageId ?? null : null
  const evidenceId = state === "sent" ? source?.evidenceId ?? null : null
  const outcomeMessage = state === "uncertain" && result.success
    ? "The source reported provider acceptance, but its receipt could not be read. Do not create another send; reconcile this unchanged operation."
    : priorOutcomeUnknown && state === "uncertain"
      ? `${result.message} The earlier provider outcome remains uncertain; do not cancel or start another operation.`
      : priorOutcomeUnknown && state === "failed"
        ? "The source delivery record confirms a conclusive failure. The same reviewed message may be retried."
    : result.message
  const { error: finishError } = await db.rpc("staff_email_review_finish", {
    p_review_id: id, p_token: token, p_state: state,
    p_provider_message_id: providerMessageId, p_delivery_evidence_id: evidenceId,
    p_error: state === "sent" ? null : outcomeMessage, p_actor: user.id,
  })
  if (finishError) throw new Error("Delivery may have completed, but its review outcome was not finalized. Do not start another send; reconcile this record.")
  revalidatePath(`/emails/review/${id}`); revalidatePath("/emails")
  return { success: state === "sent", reviewId: id, state, message: state === "sent"
    ? "Provider accepted the reviewed email. This does not confirm inbox delivery or reading."
    : outcomeMessage }
}
