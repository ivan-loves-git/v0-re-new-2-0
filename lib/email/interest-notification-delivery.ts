import "server-only"

import { createHash } from "node:crypto"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail, sendEmailDirect } from "@/lib/email/send-email"
import { InterestNotificationEmail } from "@/lib/email/templates/interest-notification"
import type { EmailTemplateKey } from "@/lib/types/email"

type EventType = "proposed_interested" | "proposed_declined" | "validated" | "rejected"
type Payload = {
  eventId: string
  eventType: EventType
  matchId: string
  repreneurId: string
  recipientEmail: string
  firstName: string
  repreneurName: string
  opportunityTitle: string
  templateKey: EmailTemplateKey
  subject: string
  body: string
}

export type InterestNotificationStatus =
  | "sent" | "already_sent" | "busy" | "suppressed" | "review_required" | "failed"

const STAFF_EMAIL = "contact@re-new.team"
const EVENT_TYPES = new Set<EventType>(["proposed_interested", "proposed_declined", "validated", "rejected"])
const TEMPLATE_KEYS = new Set<EmailTemplateKey>([
  "proposed_opportunity_response_staff", "interest_outcome_validated", "interest_outcome_rejected",
])

function isPayload(value: unknown): value is Payload {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.eventId === "string"
    && typeof record.matchId === "string"
    && typeof record.repreneurId === "string"
    && typeof record.recipientEmail === "string"
    && typeof record.firstName === "string"
    && typeof record.repreneurName === "string"
    && typeof record.opportunityTitle === "string"
    && typeof record.subject === "string"
    && typeof record.body === "string"
    && EVENT_TYPES.has(record.eventType as EventType)
    && TEMPLATE_KEYS.has(record.templateKey as EmailTemplateKey)
}

export function interestNotificationKey(eventId: string) {
  return `interest-event:${eventId}`
}

export function renderInterestNotificationCopy(payload: Payload) {
  const variables = {
    firstName: payload.firstName,
    repreneurName: payload.repreneurName,
    opportunityTitle: payload.opportunityTitle,
    responseLabel: payload.eventType === "proposed_interested" ? "avec intérêt" : "sans intérêt",
  }
  const replace = (value: string) => value.replace(/\{(\w+)\}/g, (token, key: string) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key as keyof typeof variables] : token
  ))
  return { subject: replace(payload.subject), body: replace(payload.body), variables }
}

async function complete(
  eventId: string,
  leaseToken: string,
  outcome: "sent" | "rejected" | "uncertain" | "suppressed" | "deferred",
  providerId?: string,
) {
  const { data, error } = await createAdminClient().rpc("w173_complete_interest_delivery", {
    p_event_id: eventId,
    p_lease_token: leaseToken,
    p_outcome: outcome,
    p_provider_message_id: providerId ?? null,
  })
  return error ? null : data as string | null
}

async function suppressOrReview(eventId: string, leaseToken: string): Promise<InterestNotificationStatus> {
  const completed = await complete(eventId, leaseToken, "suppressed")
  return completed === "suppressed" ? "suppressed" : completed === "review_required" ? "review_required" : "failed"
}

async function clientProviderOutcome(idempotencyKey: string) {
  const { data, error } = await createAdminClient()
    .from("email_logs")
    .select("provider_outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (error || !data) return "uncertain" as const
  return data.provider_outcome === "rejected" ? "rejected" as const : "uncertain" as const
}

/** No caller can pass a destination, reason or source field. They are resolved
 * from current canonical records after the event-scoped lease is acquired. */
export async function deliverInterestNotification(eventId: string): Promise<InterestNotificationStatus> {
  const db = createAdminClient()
  const { data: claim, error: claimError } = await db.rpc("w173_claim_interest_delivery", { p_event_id: eventId })
  if (claimError || !claim || typeof claim !== "object") return "failed"
  if (claim.status === "sent") return "already_sent"
  if (claim.status === "busy") return "busy"
  if (claim.status === "suppressed" || claim.status === "review_required") return claim.status
  if (claim.status !== "claimed" || typeof claim.leaseToken !== "string") return "failed"

  const leaseToken = claim.leaseToken
  let providerAttemptStarted = false
  try {
    const { data, error } = await db.rpc("w173_interest_delivery_payload", { p_event_id: eventId })
    if (error) return "failed"
    if (!isPayload(data) || data.eventId !== eventId) {
      return suppressOrReview(eventId, leaseToken)
    }
    const payload = data
    const staff = payload.eventType === "proposed_interested" || payload.eventType === "proposed_declined"
    const expectedKey = staff ? "proposed_opportunity_response_staff"
      : payload.eventType === "validated" ? "interest_outcome_validated" : "interest_outcome_rejected"
    if (payload.templateKey !== expectedKey) {
      return suppressOrReview(eventId, leaseToken)
    }
    const to = staff ? (env.RENEW_STAFF_NOTIFICATION_EMAIL ?? STAFF_EMAIL) : payload.recipientEmail
    const copy = renderInterestNotificationCopy(payload)
    if (!to.trim() || !copy.subject.trim() || !copy.body.trim()) {
      return suppressOrReview(eventId, leaseToken)
    }
    const digest = createHash("sha256").update(JSON.stringify([to.toLowerCase(), copy.subject, copy.body])).digest("hex")
    const beforeProviderAttempt = async () => {
      const { data: began, error: beginError } = await db.rpc("w173_begin_interest_provider_attempt", {
        p_event_id: eventId, p_lease_token: leaseToken, p_payload_sha256: digest,
        p_expected_payload: payload,
      })
      if (beginError) throw new Error("Could not verify exact interest delivery before provider I/O.")
      if (began === true) providerAttemptStarted = true
      return began === true
    }

    const idempotencyKey = interestNotificationKey(eventId)
    const react = InterestNotificationEmail({
      subject: copy.subject,
      body: copy.body,
      variables: copy.variables,
      staff,
    })
    const result = staff
      ? await sendEmailDirect({ to, subject: copy.subject, react, idempotencyKey, beforeProviderAttempt })
      : await sendEmail({
          to, subject: copy.subject, react,
          repreneurId: payload.repreneurId,
          templateKey: payload.templateKey,
          idempotencyKey,
          beforeProviderAttempt,
        })
    if (result.success && (result.resendId || !staff)) {
      return await complete(eventId, leaseToken, "sent", result.resendId) === "sent" ? "sent" : "failed"
    }
    if (result.providerOutcome === "fenced") return "failed"
    if (result.providerOutcome === "blocked") {
      return suppressOrReview(eventId, leaseToken)
    }
    if (result.providerOutcome === "deferred") {
      await complete(eventId, leaseToken, "deferred")
      return "failed"
    }
    const outcome = staff
      ? result.providerOutcome === "rejected" ? "rejected" : "uncertain"
      : await clientProviderOutcome(idempotencyKey)
    await complete(eventId, leaseToken, outcome)
    return "failed"
  } catch {
    // Any exception after the durable attempt begins could mean acceptance.
    // Keep the same provider key within 23h, then require manual review.
    if (providerAttemptStarted) await complete(eventId, leaseToken, "uncertain").catch(() => null)
    return "failed"
  }
}

export async function deliverResponseNotification(matchId: string, status: "interested" | "declined") {
  const db = createAdminClient()
  const { data: match, error: matchError } = await db.from("opportunity_matches")
    .select("status,interest_expressed_at").eq("id", matchId).maybeSingle()
  if (matchError || !match || match.status !== status) return "suppressed" as const
  let query = db.from("opportunity_interest_events")
    .select("id")
    .eq("match_id", matchId)
    .eq("event_type", status === "interested" ? "proposed_interested" : "proposed_declined")
    .order("occurred_at", { ascending: false })
    .limit(1)
  query = match.interest_expressed_at
    ? query.eq("interest_expressed_at", match.interest_expressed_at)
    : query.is("interest_expressed_at", null)
  const { data, error } = await query.maybeSingle()
  if (error || !data) return "suppressed" as const
  return deliverInterestNotification(data.id)
}

export async function deliverValidationNotification(evidenceId: string) {
  const { data, error } = await createAdminClient().from("opportunity_interest_events")
    .select("id")
    .eq("validation_evidence_id", evidenceId)
    .maybeSingle()
  if (error || !data) return "suppressed" as const
  return deliverInterestNotification(data.id)
}

/** The existing daily cron is a recovery path for a committed event whose
 * action process ended before delivery. It never scans historical matches. */
export async function runPendingInterestNotifications(limit = 8) {
  const db = createAdminClient()
  const { data, error } = await db
    .from("opportunity_interest_notification_deliveries")
    .select("event_id")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error("Could not read interest notification queue.")
  let sent = 0
  let failed = 0
  for (const row of data ?? []) {
    const status = await deliverInterestNotification(row.event_id)
    if (status === "sent") sent++
    if (status === "failed") failed++
  }
  const { count: reviewRequired, error: reviewError } = await db
    .from("opportunity_interest_notification_deliveries")
    .select("event_id", { count: "exact", head: true })
    .eq("status", "review_required")
  if (reviewError) throw new Error("Could not read interest notification review status.")
  return { sent, failed, reviewRequired: reviewRequired ?? 0 }
}
