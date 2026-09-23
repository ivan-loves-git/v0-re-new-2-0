import "server-only"

import { createHash } from "node:crypto"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, sendEmailDirect } from "@/lib/email/send-email"
import { RecommendationCycleNotificationEmail } from "@/lib/email/templates/recommendation-cycle-notification"

export type RecommendationCycleKind = "client_reminder" | "staff_expiry"
type TemplateKey = "recommendation_response_reminder" | "recommendation_unanswered_staff_alert"
type Payload = {
  cycleId: string
  kind: RecommendationCycleKind
  matchId: string
  repreneurId: string
  recipientEmail: string
  firstName: string
  repreneurName: string
  opportunityTitle: string
  templateKey: TemplateKey
  subject: string
  body: string
}
export type RecommendationCycleDeliveryStatus =
  | "sent" | "already_sent" | "busy" | "not_due" | "suppressed" | "review_required" | "failed"

const STAFF_EMAIL = "contact@re-new.team"
const KINDS = new Set<RecommendationCycleKind>(["client_reminder", "staff_expiry"])

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return typeof row.cycleId === "string"
    && KINDS.has(row.kind as RecommendationCycleKind)
    && typeof row.matchId === "string"
    && typeof row.repreneurId === "string"
    && typeof row.recipientEmail === "string"
    && typeof row.firstName === "string"
    && typeof row.repreneurName === "string"
    && typeof row.opportunityTitle === "string"
    && (row.templateKey === "recommendation_response_reminder"
      || row.templateKey === "recommendation_unanswered_staff_alert")
    && typeof row.subject === "string"
    && typeof row.body === "string"
}

export function recommendationCycleNotificationKey(cycleId: string, kind: RecommendationCycleKind) {
  return "recommendation-cycle:" + cycleId + ":" + kind
}

export function renderRecommendationCycleCopy(payload: Payload) {
  const variables = {
    firstName: payload.firstName,
    repreneurName: payload.repreneurName,
    opportunityTitle: payload.opportunityTitle,
  }
  const replace = (value: string) => value.replace(/\{(\w+)\}/g, (token, key: string) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key as keyof typeof variables] : token
  ))
  return { subject: replace(payload.subject), body: replace(payload.body), variables }
}

async function complete(
  cycleId: string, kind: RecommendationCycleKind, leaseToken: string,
  outcome: "sent" | "rejected" | "uncertain" | "suppressed" | "deferred",
  providerId?: string,
) {
  const { data, error } = await createAdminClient().rpc("w175_complete_cycle_delivery", {
    p_cycle_id: cycleId, p_kind: kind, p_lease_token: leaseToken,
    p_outcome: outcome, p_provider_message_id: providerId ?? null,
  })
  return error ? null : data as string | null
}

async function suppressOrReview(
  cycleId: string, kind: RecommendationCycleKind, leaseToken: string,
): Promise<RecommendationCycleDeliveryStatus> {
  const status = await complete(cycleId, kind, leaseToken, "suppressed")
  return status === "suppressed" ? "suppressed"
    : status === "review_required" ? "review_required" : "failed"
}

async function clientProviderOutcome(idempotencyKey: string) {
  const { data, error } = await createAdminClient().from("email_logs")
    .select("provider_outcome").eq("idempotency_key", idempotencyKey).maybeSingle()
  if (error || !data) return "uncertain" as const
  return data.provider_outcome === "rejected" ? "rejected" as const : "uncertain" as const
}

/** Only the immutable cycle and kind are caller-controlled. Recipient, copy,
 * current portal eligibility and time window are rechecked at provider I/O. */
export async function deliverRecommendationCycleNotification(
  cycleId: string, kind: RecommendationCycleKind,
): Promise<RecommendationCycleDeliveryStatus> {
  const db = createAdminClient()
  const { data: claim, error: claimError } = await db.rpc("w175_claim_cycle_delivery", {
    p_cycle_id: cycleId, p_kind: kind,
  })
  if (claimError || !claim || typeof claim !== "object") return "failed"
  if (claim.status === "sent") return "already_sent"
  if (claim.status === "busy" || claim.status === "not_due"
    || claim.status === "suppressed" || claim.status === "review_required") return claim.status
  if (claim.status !== "claimed" || typeof claim.leaseToken !== "string") return "failed"

  const leaseToken = claim.leaseToken
  let providerAttemptStarted = false
  try {
    const { data, error } = await db.rpc("w175_cycle_delivery_payload", {
      p_cycle_id: cycleId, p_kind: kind,
    })
    if (error) return "failed" // A transient DB read is not a policy suppression.
    if (!isPayload(data) || data.cycleId !== cycleId || data.kind !== kind) {
      return suppressOrReview(cycleId, kind, leaseToken)
    }
    const payload = data
    const staff = kind === "staff_expiry"
    const expectedTemplate = staff
      ? "recommendation_unanswered_staff_alert" : "recommendation_response_reminder"
    if (payload.templateKey !== expectedTemplate) {
      return suppressOrReview(cycleId, kind, leaseToken)
    }
    const to = staff ? (env.RENEW_STAFF_NOTIFICATION_EMAIL ?? STAFF_EMAIL) : payload.recipientEmail
    const copy = renderRecommendationCycleCopy(payload)
    if (!to.trim() || !copy.subject.trim() || !copy.body.trim()) {
      return suppressOrReview(cycleId, kind, leaseToken)
    }
    const digest = createHash("sha256")
      .update(JSON.stringify([to.toLowerCase(), copy.subject, copy.body])).digest("hex")
    const beforeProviderAttempt = async () => {
      const { data: began, error: beginError } = await db.rpc("w175_begin_cycle_provider_attempt", {
        p_cycle_id: cycleId, p_kind: kind, p_lease_token: leaseToken,
        p_payload_sha256: digest, p_expected_payload: payload,
      })
      if (beginError) throw new Error("Could not verify exact recommendation cycle before provider I/O.")
      if (began === true) providerAttemptStarted = true
      return began === true
    }
    const idempotencyKey = recommendationCycleNotificationKey(cycleId, kind)
    const react = RecommendationCycleNotificationEmail({
      subject: copy.subject, body: copy.body, variables: copy.variables, staff,
    })
    const result = staff
      ? await sendEmailDirect({ to, subject: copy.subject, react, idempotencyKey, beforeProviderAttempt })
      : await sendEmail({
          to, subject: copy.subject, react, repreneurId: payload.repreneurId,
          templateKey: payload.templateKey, idempotencyKey, beforeProviderAttempt,
        })
    if (result.success && (result.resendId || !staff)) {
      return await complete(cycleId, kind, leaseToken, "sent", result.resendId) === "sent"
        ? "sent" : "failed"
    }
    if (result.providerOutcome === "fenced" || result.providerOutcome === "blocked") {
      return suppressOrReview(cycleId, kind, leaseToken)
    }
    if (result.providerOutcome === "deferred") {
      const status = await complete(cycleId, kind, leaseToken, "deferred")
      return status === "review_required" ? "review_required" : "failed"
    }
    const outcome = staff
      ? result.providerOutcome === "rejected" ? "rejected" : "uncertain"
      : await clientProviderOutcome(idempotencyKey)
    const status = await complete(cycleId, kind, leaseToken, outcome)
    return status === "review_required" ? "review_required" : "failed"
  } catch {
    if (providerAttemptStarted) {
      await complete(cycleId, kind, leaseToken, "uncertain").catch(() => null)
    }
    return "failed"
  }
}

/** One small daily family job: fresh/retry and client/staff work share slots.
 * An active provider promise is always awaited. The elapsed budget stops only
 * the next item, and updated_at rotates persistent retry failures. */
export async function runPendingRecommendationCycleNotifications(limit = 4, budgetMs = 40_000) {
  const db = createAdminClient()
  const due = new Date().toISOString()
  const kinds: RecommendationCycleKind[] = ["client_reminder", "staff_expiry"]
  const specifications = [
    { kind: kinds[0], status: "pending" },
    { kind: kinds[1], status: "pending" },
    { kind: kinds[0], status: "failed" },
    { kind: kinds[1], status: "failed" },
  ] as const
  const queues = await Promise.all(specifications.map(({ kind, status }) => (
    db.from("opportunity_recommendation_cycle_deliveries")
      .select("cycle_id,kind").eq("kind", kind).eq("status", status)
      .lte("due_at", due).order("updated_at", { ascending: true }).limit(limit)
  )))
  if (queues.some(({ error }) => error)) {
    throw new Error("Could not read recommendation cycle notification queue.")
  }
  const rows = queues.map(({ data }) => [...(data ?? [])])
  const selected: Array<{ cycleId: string; kind: RecommendationCycleKind }> = []
  while (selected.length < limit && rows.some((queue) => queue.length > 0)) {
    for (let index = 0; index < rows.length && selected.length < limit; index++) {
      const row = rows[index].shift()
      if (row) selected.push({ cycleId: row.cycle_id, kind: row.kind as RecommendationCycleKind })
    }
  }
  let sent = 0
  let failed = 0
  let processed = 0
  const started = Date.now()
  for (const row of selected) {
    if (Date.now() - started >= budgetMs) break
    const status = await deliverRecommendationCycleNotification(row.cycleId, row.kind)
    processed++
    if (status === "sent") sent++
    if (status === "failed") failed++
  }
  const { count: reviewRequired, error: reviewError } = await db
    .from("opportunity_recommendation_cycle_deliveries")
    .select("cycle_id", { count: "exact", head: true }).eq("status", "review_required")
  if (reviewError) throw new Error("Could not read recommendation cycle delivery review status.")
  return { sent, failed, reviewRequired: reviewRequired ?? 0,
    processed, budgetDeferred: selected.length - processed }
}
