"use server"

import { createHash } from "node:crypto"
import { requireStaffAccess } from "@/lib/access-control"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  getMaReviewContext,
  getMaReviewTemplateVersion,
  renderMaWorkflowContent,
} from "@/lib/ma-workflows"
import { preparePursuitHandoff } from "@/lib/pursuit-handoff-delivery"
import {
  fixedIntermediaryHandoffCopy,
  buildPursuitNdaReadyRequest,
} from "@/lib/pursuit-handoff-copy"
import { sendOpportunityFreshnessReview } from "@/lib/opportunity-freshness-send"
import {
  emailReviewSearchPattern,
  emailReviewSortColumn,
  type EmailReviewQueueOptions,
  type EmailReviewQueueRow,
} from "@/lib/email/review-queue-query"
import { PURSUIT_REVIEW_COPY_VERSION } from "@/lib/email/review-copy-version"
import { currentStaffEmailAttempt } from "@/lib/email/staff-email-attempt"
import { dispatchReservedStaffEmailReview } from "@/lib/email/staff-email-reserved-dispatch"
import { sameAttachmentSnapshot } from "@/lib/staff-email-review-guard"
import { isUuid } from "@/lib/uuid"
import { revalidatePath } from "next/cache"

const MA_KEYS = new Set([
  "ma_opportunity_validity_check",
  "ma_request_more_information",
  "ma_repreneur_interest_feedback",
  "ma_nda_info_memo_request",
  "ma_process_follow_up",
])
type SourceKind = "ma" | "e4" | "e6" | "e7" | "freshness" | "business"

export interface StaffEmailReview {
  id: string
  source_kind: SourceKind
  source_operation_id: string
  opportunity_id: string
  match_id: string | null
  upstream_evidence_id: string | null
  contact_link_id: string | null
  recipient_email: string
  namespace: "REAL" | "DEMO"
  template_key: string
  template_version: string
  subject: string
  body_text: string
  attachment_snapshot: Array<{
    artifact_id: string
    document_id: string
    content_sha256: string
    file_name: string
    mime_type: string
    size_bytes: number
  }>
  state: "pending" | "sending" | "sent" | "failed" | "uncertain" | "cancelled"
  version: number
  archived_at: string | null
  archived_by: string | null
  restored_at: string | null
  restored_by: string | null
  created_by: string
  created_at: string
  edited_by: string | null
  edited_at: string | null
  approved_by: string | null
  approved_at: string | null
  attempted_at: string | null
  attempted_payload?: Record<string, unknown> | null
  outcome_at: string | null
  provider_message_id: string | null
  delivery_evidence_id: string | null
  source_context?: Record<string, unknown>
  prepared_policy?: { auto_send: boolean; version: number }
  repreneur_id?: string | null
  retained_html?: string | null
  protected_links?: string[]
  provider_cc?: string[]
  delivery_error: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

function requireId(id: string) {
  if (!isUuid(id)) throw new Error("Choose a valid review record.")
}

async function reviewById(id: string): Promise<StaffEmailReview> {
  requireId(id)
  const { data, error } = await createAdminClient()
    .from("staff_email_reviews")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) throw new Error("This review record is unavailable.")
  return data as StaffEmailReview
}

export async function listStaffEmailReviews(options: EmailReviewQueueOptions) {
  await requireStaffAccess()
  const db = createAdminClient()
  const pageSize = 25
  const activeStates = ["pending", "sending", "uncertain", "failed"]
  const filtered = (columns: string, head = false) => {
    let query = db.from("staff_email_review_queue").select(columns, { count: "exact", head })
    if (options.view === "active") query = query.is("archived_at", null).in("state", activeStates)
    if (options.view === "archived") query = query.not("archived_at", "is", null)
    if (options.purpose !== "all") query = query.eq("purpose_key", options.purpose)
    if (options.search) query = query.ilike("search_text", emailReviewSearchPattern(options.search))
    return query
  }
  const [filteredCount, activeCount, archivedCount, allCount] = await Promise.all([
    filtered("id", true),
    db
      .from("staff_email_review_queue")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in("state", activeStates),
    db
      .from("staff_email_review_queue")
      .select("id", { count: "exact", head: true })
      .not("archived_at", "is", null),
    db.from("staff_email_review_queue").select("id", { count: "exact", head: true }),
  ])
  if (
    filteredCount.error ||
    activeCount.error ||
    archivedCount.error ||
    allCount.error ||
    [filteredCount.count, activeCount.count, archivedCount.count, allCount.count].some(
      (count) => typeof count !== "number",
    )
  ) {
    throw new Error("The review queue is unavailable.")
  }
  const total = filteredCount.count ?? 0
  const page = Math.min(options.page, Math.max(1, Math.ceil(total / pageSize)))
  const sortColumn = emailReviewSortColumn(options.sort)
  let query = filtered(
    "id,source_kind,template_key,subject,body_preview,recipient_email,namespace,state,version,created_at,recipient_name,recipient_avatar_url,company_name,purpose_key,purpose_label,archived_at,archive_eligible",
  ).order(sortColumn, { ascending: options.direction === "asc", nullsFirst: false })
  if (sortColumn !== "created_at") query = query.order("created_at", { ascending: false })
  const { data, error } = await query
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw new Error("The review queue is unavailable.")
  return {
    ...options,
    reviews: (data ?? []) as unknown as EmailReviewQueueRow[],
    total,
    page,
    pageSize,
    activeCount: activeCount.count!,
    archivedCount: archivedCount.count!,
    allCount: allCount.count!,
  }
}

export async function getStaffEmailReview(id: string) {
  await requireStaffAccess()
  const review = await reviewById(id)
  const db = createAdminClient()
  const [
    { data, error },
    template,
    memberResult,
    replyResult,
    archiveEligibility,
    recipientDisplay,
    opportunityDisplay,
  ] = await Promise.all([
    db
      .from("staff_email_review_events")
      .select("id,event_kind,actor,occurred_at,version,detail")
      .eq("review_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
    db
      .from("email_templates")
      .select("template_key,subject,body_markdown,body_editable,is_active")
      .eq("template_key", review.template_key)
      .maybeSingle(),
    review.source_kind === "freshness"
      ? db
          .from("opportunity_freshness_members")
          .select("opportunity_id,episode_key,frozen_member")
          .eq("review_id", id)
          .order("opportunity_id")
      : Promise.resolve({ data: [], error: null }),
    review.source_kind === "freshness"
      ? db
          .from("opportunity_freshness_replies")
          .select("id,opportunity_id,outcome,reply_at,evidence,recorded_by,recorded_at")
          .eq("review_id", id)
          .order("reply_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    db.rpc("staff_email_review_archive_source_clear", { p_review_id: id }),
    db
      .from("staff_email_review_queue")
      .select("recipient_email,recipient_name,company_name,purpose_label")
      .eq("id", id)
      .maybeSingle(),
    review.source_kind === "freshness" || review.source_kind === "business"
      ? Promise.resolve({ data: null, error: null })
      : db
          .from("opportunities")
          .select("id,reference,public_title")
          .eq("id", review.opportunity_id)
          .maybeSingle(),
  ])
  if (error || memberResult.error || replyResult.error || archiveEligibility.error)
    throw new Error("The review history is unavailable.")
  const catalogue = template.data
    ? {
        ...template.data,
        version:
          review.source_kind === "business"
            ? createHash("md5")
                .update(
                  [
                    template.data.subject,
                    template.data.body_markdown,
                    String(template.data.body_editable),
                  ].join("|"),
                )
                .digest("hex")
            : createHash("sha256")
                .update(
                  JSON.stringify([
                    template.data.subject,
                    template.data.body_markdown,
                    template.data.body_editable,
                  ]),
                )
                .digest("hex"),
      }
    : null
  return {
    review,
    events: (data ?? []).reverse(),
    archiveEligible: archiveEligibility.data === true,
    display: {
      recipient:
        !recipientDisplay.error && recipientDisplay.data?.recipient_email === review.recipient_email
          ? (recipientDisplay.data as {
              recipient_email: string
              recipient_name: string | null
              company_name: string | null
              purpose_label: string
            })
          : null,
      opportunity:
        !opportunityDisplay.error && opportunityDisplay.data?.id === review.opportunity_id
          ? (opportunityDisplay.data as {
              id: string
              reference: string
              public_title: string | null
            })
          : null,
    },
    catalogue,
    catalogueEnabled: !template.error && template.data?.is_active === true,
    asOf: new Date().toISOString(),
    members: (memberResult.data ?? []) as Array<{
      opportunity_id: string
      episode_key: string
      frozen_member: Record<string, string | null>
    }>,
    replies: (replyResult.data ?? []) as Array<{
      id: string
      opportunity_id: string
      outcome: string
      reply_at: string
      evidence: string
      recorded_by: string
      recorded_at: string
    }>,
  }
}

async function persistPreparation(input: {
  sourceKind: SourceKind
  sourceOperationId: string
  opportunityId: string
  matchId: string | null
  upstreamId: string | null
  contactLinkId: string | null
  recipientEmail: string
  namespace: "REAL" | "DEMO"
  templateKey: string
  templateVersion: string
  subject: string
  body: string
  attachmentSnapshot: StaffEmailReview["attachment_snapshot"]
}) {
  const { user } = await requireStaffAccess()
  const { data, error } = await createAdminClient().rpc("staff_email_review_prepare", {
    p_source_kind: input.sourceKind,
    p_source_operation_id: input.sourceOperationId,
    p_opportunity_id: input.opportunityId,
    p_match_id: input.matchId,
    p_upstream_evidence_id: input.upstreamId,
    p_contact_link_id: input.contactLinkId,
    p_recipient_email: input.recipientEmail,
    p_namespace: input.namespace,
    p_template_key: input.templateKey,
    p_template_version: input.templateVersion,
    p_subject: input.subject,
    p_body_text: input.body,
    p_attachment_snapshot: input.attachmentSnapshot,
    p_actor: user.id,
  })
  if (error?.message?.includes("staff_email_review_unresolved_source_blocks_new_draft")) {
    throw new Error(
      "An earlier email for this opportunity is in flight or uncertain. Reopen that review; do not create a new draft to resend.",
    )
  }
  if (error || typeof data !== "string")
    throw new Error("The review draft could not be saved safely.")
  revalidatePath("/emails")
  const { data: automatic } = await createAdminClient().rpc("email_review_claim_future_auto", {
    p_review_id: data,
  })
  if (automatic === true) return approveReviewedMessage(data, 1, true)
  return {
    success: true as const,
    reviewId: data,
    message: "Draft prepared for staff review. Nothing was sent.",
  }
}

export async function prepareMaEmailReview(input: {
  opportunityId: string
  sourceOperationId: string
  templateKey: string
  contactLinkId: string
  subject: string
  body: string
}) {
  await requireStaffAccess()
  requireId(input.opportunityId)
  requireId(input.sourceOperationId)
  requireId(input.contactLinkId)
  if (!MA_KEYS.has(input.templateKey) || !input.subject.trim() || !input.body.trim()) {
    throw new Error("Choose an existing M&A template and complete its subject and message.")
  }
  const context = await getMaReviewContext(input.opportunityId, input.contactLinkId)
  if (input.templateKey === "ma_nda_info_memo_request" && !context.activeMatchId) {
    throw new Error("Validate an active pursuit before preparing this NDA/memo request.")
  }
  const version = await getMaReviewTemplateVersion(input.templateKey, false)
  const content = await renderMaWorkflowContent(input.opportunityId, input.subject, input.body)
  return persistPreparation({
    sourceKind: "ma",
    sourceOperationId: input.sourceOperationId,
    opportunityId: input.opportunityId,
    matchId: null,
    upstreamId: null,
    contactLinkId: context.contactLinkId,
    recipientEmail: context.recipientEmail,
    namespace: context.namespace,
    templateKey: input.templateKey,
    templateVersion: version,
    subject: content.subject,
    body: content.body,
    attachmentSnapshot: [],
  })
}

export async function preparePursuitEmailReview(matchId: string, type: "e4" | "e6" | "e7") {
  await requireStaffAccess()
  requireId(matchId)
  if (!["e4", "e6", "e7"].includes(type)) throw new Error("Choose an included pursuit handoff.")
  const { handoff, context } = await preparePursuitHandoff(createAdminClient(), matchId, type)
  if (type === "e6") {
    const request = buildPursuitNdaReadyRequest(matchId, context)
    return persistPreparation({
      sourceKind: "e6",
      sourceOperationId: handoff.upstreamId,
      opportunityId: handoff.opportunityId,
      matchId,
      upstreamId: handoff.upstreamId,
      contactLinkId: null,
      recipientEmail: request.to[0],
      namespace: context.opportunity.is_demo ? "DEMO" : "REAL",
      templateKey: "code:e6_nda_ready",
      templateVersion: PURSUIT_REVIEW_COPY_VERSION.e6,
      subject: request.subject,
      body: request.text,
      attachmentSnapshot: [],
    })
  }
  const blankPresent = context.upstream.metadata?.blank_nda_present_at_validation
  if (type === "e4" && typeof blankPresent !== "boolean") {
    throw new Error(
      "This historical validation lacks a frozen NDA request. Revalidate the pursuit first.",
    )
  }
  const ma = await getMaReviewContext(handoff.opportunityId)
  const copy = fixedIntermediaryHandoffCopy(type, Boolean(blankPresent))
  const rendered = await renderMaWorkflowContent(handoff.opportunityId, copy.subject, copy.body)
  await getMaReviewTemplateVersion("ma_nda_info_memo_request", false)
  return persistPreparation({
    sourceKind: type,
    sourceOperationId: handoff.upstreamId,
    opportunityId: handoff.opportunityId,
    matchId,
    upstreamId: handoff.upstreamId,
    contactLinkId: ma.contactLinkId,
    recipientEmail: ma.recipientEmail,
    namespace: ma.namespace,
    templateKey: "ma_nda_info_memo_request",
    templateVersion: PURSUIT_REVIEW_COPY_VERSION[type],
    subject: rendered.subject,
    body: rendered.body,
    attachmentSnapshot: handoff.snapshot,
  })
}

export async function editStaffEmailReview(
  id: string,
  version: number,
  subject: string,
  body: string,
) {
  const { user } = await requireStaffAccess()
  requireId(id)
  const review = await reviewById(id)
  const { error } =
    review.source_kind === "freshness"
      ? await createAdminClient().rpc("opportunity_freshness_edit", {
          p_review_id: id,
          p_version: version,
          p_subject: subject,
          p_body: body,
          p_actor: user.id,
        })
      : await createAdminClient().rpc("staff_email_review_edit", {
          p_review_id: id,
          p_version: version,
          p_subject: subject,
          p_body_text: body,
          p_actor: user.id,
        })
  if (error) throw new Error("The draft changed or cannot be edited. Refresh before trying again.")
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return { success: true as const, message: "Review text saved. The template was not changed." }
}

export async function applyNewerStaffEmailTemplate(id: string, version: number) {
  const { user } = await requireStaffAccess()
  const record = await getStaffEmailReview(id),
    review = record.review
  if (
    review.version !== version ||
    review.state !== "pending" ||
    review.archived_at ||
    review.attempted_payload
  )
    throw new Error("Refresh this unattempted draft before replacing its words.")
  const template = record.catalogue
  if (!template) throw new Error("Current reusable copy is unavailable for this governed message.")
  let subject: string,
    body: string,
    html: string | null = null
  if (review.source_kind === "freshness") {
    if (!template.body_markdown) throw new Error("Current template body is unavailable.")
    const copy = (await import("@/lib/opportunity-freshness-copy")).renderGroupedFreshnessCopy({
      subject: template.subject,
      body: template.body_markdown,
      contactName: record.display.recipient?.recipient_name ?? "",
      members: record.members.map((member) => ({
        opportunityId: member.opportunity_id,
        reference: member.frozen_member.reference ?? "",
        title: member.frozen_member.title ?? "",
        firmName: member.frozen_member.firm_name ?? "",
        revenueMeur: member.frozen_member.revenue_meur == null ? null : Number(member.frozen_member.revenue_meur),
      })),
    })
    subject = copy.subject
    body = copy.body
  } else if (review.source_kind === "ma") {
    if (!template.body_editable || !template.body_markdown)
      throw new Error("This catalogue body is governed in code.")
    const copy = await renderMaWorkflowContent(
      review.opportunity_id,
      template.subject,
      template.body_markdown,
    )
    subject = copy.subject
    body = copy.body
  } else if (review.source_kind === "business") {
    const copy = await (
      await import("@/lib/email/business-current-copy")
    ).businessCurrentCopy(review)
    subject = copy.subject
    body = copy.body
    html = copy.html
  } else {
    const { handoff, context } = await preparePursuitHandoff(
      createAdminClient(),
      review.match_id!,
      review.source_kind,
    )
    if (
      handoff.upstreamId !== review.source_operation_id ||
      !sameAttachmentSnapshot(handoff.snapshot, review.attachment_snapshot)
    )
      throw new Error("The current pursuit documents changed.")
    if (review.source_kind === "e6") {
      const copy = buildPursuitNdaReadyRequest(review.match_id!, context)
      subject = copy.subject
      body = copy.text
      html = copy.html
    } else {
      const copy = fixedIntermediaryHandoffCopy(
        review.source_kind,
        Boolean(context.upstream.metadata?.blank_nda_present_at_validation),
      )
      const rendered = await renderMaWorkflowContent(review.opportunity_id, copy.subject, copy.body)
      subject = rendered.subject
      body = rendered.body
    }
  }
  const { error } = await createAdminClient().rpc(review.source_kind === "freshness" ? "opportunity_freshness_replace_words" : "email_review_replace_words", {
    p_review_id: id,
    p_version: version,
    p_subject: subject,
    p_body: body,
    ...(review.source_kind === "freshness" ? {} : { p_html: html }),
    p_template_version:
      review.source_kind === "e4" || review.source_kind === "e6" || review.source_kind === "e7"
        ? PURSUIT_REVIEW_COPY_VERSION[review.source_kind]
        : template.version,
    p_actor: user.id,
  })
  if (error)
    throw new Error(
      "The draft changed or protected content prevented replacement. Prepared words remain intact.",
    )
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return {
    success: true as const,
    message:
      "Newer template copy applied to this draft only. Review the new version before sending.",
  }
}

export async function refreshOpportunityFreshnessReview(id: string, version: number) {
  const { user } = await requireStaffAccess()
  requireId(id)
  const templateVersion = await getMaReviewTemplateVersion("ma_opportunity_validity_check", false)
  const { error } = await createAdminClient().rpc("opportunity_freshness_refresh", {
    p_review_id: id,
    p_version: version,
    p_template_version: templateVersion,
    p_actor: user.id,
  })
  if (error)
    throw new Error(
      "A member is no longer eligible or the review changed. Inspect and cancel the whole group if necessary.",
    )
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return {
    success: true as const,
    message:
      "Exact group evidence refreshed; review the unchanged words and new version before sending.",
  }
}

export async function recordOpportunityFreshnessReply(input: {
  reviewId: string
  opportunityId: string
  outcome: "confirmed_open" | "closed" | "paused" | "unclear"
  replyAt: string
  evidence: string
}) {
  const { user } = await requireStaffAccess()
  requireId(input.reviewId)
  requireId(input.opportunityId)
  const { error } = await createAdminClient().rpc("opportunity_freshness_record_reply", {
    p_review_id: input.reviewId,
    p_opportunity_id: input.opportunityId,
    p_outcome: input.outcome,
    p_reply_at: input.replyAt,
    p_evidence: input.evidence,
    p_actor: user.id,
  })
  if (error)
    throw new Error(
      "The exact member reply could not be recorded. Check the sent review and evidence.",
    )
  revalidatePath(`/emails/review/${input.reviewId}`)
  revalidatePath("/emails")
  return {
    success: true as const,
    message:
      input.outcome === "confirmed_open"
        ? "Confirmed-open evidence recorded for this opportunity only; its 45-day clock restarts from the reply."
        : "Reply evidence recorded. Opportunity lifecycle did not change automatically.",
  }
}

export async function cancelStaffEmailReview(id: string, version: number, reason: string) {
  const { user } = await requireStaffAccess()
  requireId(id)
  const { error } = await createAdminClient().rpc("staff_email_review_cancel", {
    p_review_id: id,
    p_version: version,
    p_reason: reason,
    p_actor: user.id,
  })
  if (error)
    throw new Error(
      "This draft cannot be cancelled or its version changed. Refresh and inspect its delivery state.",
    )
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return { success: true as const, message: "Draft cancelled with a retained reason." }
}

type ArchiveTransition = "archive" | "restore"
type ArchiveSelection = { id: string; version: number }

async function changeArchiveState(
  input: ArchiveSelection,
  actor: string,
  transition: ArchiveTransition,
) {
  requireId(input.id)
  if (!Number.isSafeInteger(input.version) || input.version < 1)
    throw new Error("Refresh the exact review version.")
  const { data, error } = await createAdminClient().rpc(
    transition === "archive" ? "staff_email_review_archive" : "staff_email_review_restore",
    { p_review_id: input.id, p_version: input.version, p_actor: actor },
  )
  if (error || !Number.isSafeInteger(data)) {
    throw new Error(
      "This draft changed or its delivery evidence no longer permits this action. Refresh and inspect it.",
    )
  }
  return data as number
}

export async function archiveStaffEmailReview(id: string, version: number) {
  const { user } = await requireStaffAccess()
  await changeArchiveState({ id, version }, user.id, "archive")
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return { success: true as const, message: "Draft put aside. No email was sent." }
}

export async function restoreStaffEmailReview(id: string, version: number) {
  const { user } = await requireStaffAccess()
  await changeArchiveState({ id, version }, user.id, "restore")
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return {
    success: true as const,
    message: "Same draft restored for review. Sending still requires current checks.",
  }
}

export async function changeStaffEmailReviewArchiveSelection(
  items: ArchiveSelection[],
  transition: ArchiveTransition,
) {
  const { user } = await requireStaffAccess()
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 25 ||
    !["archive", "restore"].includes(transition) ||
    items.some(
      (item) =>
        !item || !isUuid(item.id) || !Number.isSafeInteger(item.version) || item.version < 1,
    ) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error("Choose up to 25 distinct drafts from the current page.")
  }
  const outcomes: Array<{ id: string; outcome: "archived" | "restored" | "blocked" }> = []
  for (const item of items) {
    try {
      await changeArchiveState(item, user.id, transition)
      outcomes.push({ id: item.id, outcome: transition === "archive" ? "archived" : "restored" })
    } catch {
      outcomes.push({ id: item.id, outcome: "blocked" })
    }
  }
  revalidatePath("/emails")
  return {
    outcomes,
    message: `${outcomes.filter((item) => item.outcome !== "blocked").length} of ${items.length} drafts ${transition === "archive" ? "archived" : "restored"}. Refresh blocked items before retrying.`,
  }
}

export async function approveAndSendStaffEmailReview(id: string, version: number, freshnessCopyConfirmed = false) {
  return approveReviewedMessage(id, version, false, freshnessCopyConfirmed)
}

async function approveReviewedMessage(id: string, version: number, automatic: boolean, freshnessCopyConfirmed = false) {
  const { user } = await requireStaffAccess()
  const review = await reviewById(id)
  if (review.archived_at)
    throw new Error("This draft is archived. Restore and review it before any send.")
  if (review.version !== version)
    throw new Error("This review changed. Refresh before approving its exact version.")
  if (review.source_kind === "freshness") {
    const result = await sendOpportunityFreshnessReview(review, version, user.id, undefined, !automatic, freshnessCopyConfirmed)
    revalidatePath(`/emails/review/${id}`)
    revalidatePath("/emails")
    return result
  }
  const { payload } = await currentStaffEmailAttempt(review)
  const manualHandoff = !automatic && ["e4", "e6", "e7"].includes(review.source_kind)
  const manualBusiness = !automatic && review.source_kind === "business"
  if (!automatic && !manualHandoff && !manualBusiness) {
    const { error } = await createAdminClient().rpc("email_review_mark_manual", {
      p_review_id: id,
      p_version: version,
      p_actor: user.id,
    })
    if (error) throw new Error("This review changed before approval. Refresh its exact version.")
  }
  const db = createAdminClient()
  const { data: token, error: reserveError } =
    review.source_kind === "business"
      ? await db.rpc(manualBusiness ? "email_business_reserve_manual" : "email_business_reserve", {
          p_review_id: id,
          p_version: version,
          p_actor: user.id,
        })
      : await db.rpc(manualHandoff ? "staff_email_review_reserve_manual_handoff" : "staff_email_review_reserve", {
          p_review_id: id,
          p_version: version,
          p_payload: payload,
          p_actor: user.id,
        })
  if (reserveError || typeof token !== "string") {
    throw new Error(
      reserveError?.message?.includes("reconciliation_required")
        ? review.state === "failed"
          ? "This failed handoff's unchanged retry window expired. Reconcile the source record; do not mint a replacement operation."
          : "This earlier outcome is uncertain and its safe replay window expired. Reconcile it; do not resend."
        : "This review is stale, in flight or blocked by another uncertain send. Refresh its state.",
    )
  }

  // Keep the original approving actor for MA's unchanged-operation replay.
  const reserved = await reviewById(id)
  const result = await dispatchReservedStaffEmailReview(
    review,
    user.id,
    token,
    undefined,
    reserved.approved_by ?? user.id,
  )
  revalidatePath(`/emails/review/${id}`)
  revalidatePath("/emails")
  return result
}
