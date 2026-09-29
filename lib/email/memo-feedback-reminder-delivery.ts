import "server-only"

import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send-email"
import { MemoFeedbackReminderEmail } from "@/lib/email/templates/memo-feedback-reminder"

type Payload = {
  grantEvidenceId: string
  matchId: string
  repreneurId: string
  recipientEmail: string
  firstName: string
  opportunityTitle: string
  templateKey: "memo_feedback_reminder"
  subject: string
  body: string
}

export type MemoFeedbackReminderStatus =
  | "sent" | "already_sent" | "busy" | "not_due" | "suppressed" | "review_required" | "failed"

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return typeof row.grantEvidenceId === "string"
    && typeof row.matchId === "string"
    && typeof row.repreneurId === "string"
    && typeof row.recipientEmail === "string"
    && typeof row.firstName === "string"
    && typeof row.opportunityTitle === "string"
    && row.templateKey === "memo_feedback_reminder"
    && typeof row.subject === "string"
    && typeof row.body === "string"
}

export function memoFeedbackReminderKey(grantEvidenceId: string) {
  return `memo-feedback-grant:${grantEvidenceId}`
}

export function renderMemoFeedbackCopy(payload: Payload) {
  const variables = { firstName: payload.firstName, opportunityTitle: payload.opportunityTitle }
  const replace = (value: string) => value.replace(/\{(\w+)\}/g, (token, key: string) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key as keyof typeof variables] : token
  ))
  return { subject: replace(payload.subject), body: replace(payload.body), variables }
}

async function complete(
  grantEvidenceId: string, leaseToken: string,
  outcome: "sent" | "rejected" | "uncertain" | "suppressed" | "deferred",
  providerId?: string,
) {
  const { data, error } = await createAdminClient().rpc("w174_complete_memo_feedback_reminder", {
    p_grant_evidence_id: grantEvidenceId,
    p_lease_token: leaseToken,
    p_outcome: outcome,
    p_provider_message_id: providerId ?? null,
  })
  return error ? null : data as string | null
}

async function suppressOrReview(grantEvidenceId: string, leaseToken: string): Promise<MemoFeedbackReminderStatus> {
  const completed = await complete(grantEvidenceId, leaseToken, "suppressed")
  return completed === "suppressed" ? "suppressed" : completed === "review_required" ? "review_required" : "failed"
}

async function providerOutcome(idempotencyKey: string) {
  const { data, error } = await createAdminClient().from("email_logs")
    .select("provider_outcome").eq("idempotency_key", idempotencyKey).maybeSingle()
  if (error || !data) return "uncertain" as const
  return data.provider_outcome === "rejected" ? "rejected" as const : "uncertain" as const
}

/** Exact grant is the sole caller input. The canonical destination, current
 * entitlement and approved custom copy are re-read under the provider fence. */
export async function deliverMemoFeedbackReminder(grantEvidenceId: string): Promise<MemoFeedbackReminderStatus> {
  const db = createAdminClient()
  const { data: claim, error: claimError } = await db.rpc("w174_claim_memo_feedback_reminder", {
    p_grant_evidence_id: grantEvidenceId,
  })
  if (claimError || !claim || typeof claim !== "object") return "failed"
  if (claim.status === "sent") return "already_sent"
  if (claim.status === "busy" || claim.status === "not_due"
    || claim.status === "suppressed" || claim.status === "review_required") return claim.status
  if (claim.status !== "claimed" || typeof claim.leaseToken !== "string") return "failed"

  const leaseToken = claim.leaseToken
  let providerAttemptStarted = false
  try {
    const { data, error } = await db.rpc("w174_memo_feedback_delivery_payload", {
      p_grant_evidence_id: grantEvidenceId,
    })
    if (error) return "failed" // an operational read error cannot terminally suppress an intent
    if (!isPayload(data) || data.grantEvidenceId !== grantEvidenceId) {
      return suppressOrReview(grantEvidenceId, leaseToken)
    }
    const payload = data
    const copy = renderMemoFeedbackCopy(payload)
    if (!payload.recipientEmail.trim() || !copy.subject.trim() || !copy.body.trim()) {
      return suppressOrReview(grantEvidenceId, leaseToken)
    }
    const digest = createHash("sha256")
      .update(JSON.stringify([payload.recipientEmail.toLowerCase(), copy.subject, copy.body]))
      .digest("hex")
    const beforeProviderAttempt = async () => {
      const { data: began, error: beginError } = await db.rpc("w174_begin_memo_feedback_provider_attempt", {
        p_grant_evidence_id: grantEvidenceId,
        p_lease_token: leaseToken,
        p_payload_sha256: digest,
        p_expected_payload: payload,
      })
      if (beginError) throw new Error("Could not verify exact memo reminder before provider I/O.")
      if (began === true) providerAttemptStarted = true
      return began === true
    }
    const idempotencyKey = memoFeedbackReminderKey(grantEvidenceId)
    const result = await sendEmail({
      to: payload.recipientEmail,
      subject: copy.subject,
      react: MemoFeedbackReminderEmail(copy),
      repreneurId: payload.repreneurId,
      templateKey: payload.templateKey,
      idempotencyKey,
      beforeProviderAttempt,
    })
    if (result.success) {
      return await complete(grantEvidenceId, leaseToken, "sent", result.resendId) === "sent" ? "sent" : "failed"
    }
    if (result.providerOutcome === "fenced") return "failed"
    if (result.providerOutcome === "blocked") return suppressOrReview(grantEvidenceId, leaseToken)
    if (result.providerOutcome === "deferred") {
      await complete(grantEvidenceId, leaseToken, "deferred")
      return "failed"
    }
    await complete(grantEvidenceId, leaseToken, await providerOutcome(idempotencyKey))
    return "failed"
  } catch {
    // After the durable boundary, a thrown transport result might already
    // represent an accepted provider request. Never blindly re-key it.
    if (providerAttemptStarted) await complete(grantEvidenceId, leaseToken, "uncertain").catch(() => null)
    return "failed"
  }
}

/** Daily recovery scans only new immutable grant intents. Every delivery is
 * fully awaited; the elapsed budget stops starting *new* work, not an active
 * provider request. Retry rows rotate by last evaluation so one bad address
 * cannot monopolize a small daily batch. */
export async function runPendingMemoFeedbackReminders(limit = 4, budgetMs = 40_000) {
  const db = createAdminClient()
  const due = new Date().toISOString()
  const [fresh, retry] = await Promise.all([
    db.from("opportunity_memo_feedback_reminders")
      .select("grant_evidence_id")
      .eq("status", "pending").lte("due_at", due)
      .order("updated_at", { ascending: true }).limit(limit),
    db.from("opportunity_memo_feedback_reminders")
      .select("grant_evidence_id")
      .eq("status", "failed").lte("due_at", due)
      .order("updated_at", { ascending: true }).limit(limit),
  ])
  if (fresh.error || retry.error) throw new Error("Could not read memo feedback reminder queue.")
  const pending = [...(fresh.data ?? [])]
  const failedRows = [...(retry.data ?? [])]
  const selected: string[] = []
  while (selected.length < limit && (pending.length || failedRows.length)) {
    if (pending.length) selected.push(pending.shift()!.grant_evidence_id)
    if (selected.length < limit && failedRows.length) selected.push(failedRows.shift()!.grant_evidence_id)
  }
  let sent = 0
  let failed = 0
  let processed = 0
  const started = Date.now()
  for (const grantId of selected) {
    if (Date.now() - started >= budgetMs) break
    const status = await deliverMemoFeedbackReminder(grantId)
    processed++
    if (status === "sent") sent++
    if (status === "failed") failed++
  }
  const { count: reviewRequired, error: reviewError } = await db
    .from("opportunity_memo_feedback_reminders")
    .select("grant_evidence_id", { count: "exact", head: true })
    .eq("status", "review_required")
  if (reviewError) throw new Error("Could not read memo feedback reminder review status.")
  return { sent, failed, reviewRequired: reviewRequired ?? 0,
    processed, budgetDeferred: selected.length - processed }
}
