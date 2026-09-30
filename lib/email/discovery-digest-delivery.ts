import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/send-email"
import { DiscoveryDigestEmail, type DiscoveryDigestItem } from "@/lib/email/templates/discovery-digest"

type FrozenPayload = {
  recipientEmail: string
  firstName: string
  subject: string
  items: Array<DiscoveryDigestItem & { opportunityId: string }>
}

type Claim = {
  status: string
  leaseToken?: string
  payloadSha256?: string
  payload?: unknown
  repreneurId?: string
}

type DeliveryResult = "sent" | "busy" | "suppressed" | "uncertain" | "review_required" | "pending" | "failed"

function isFrozenPayload(value: unknown): value is FrozenPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  if (typeof row.recipientEmail !== "string" || !row.recipientEmail.trim()
    || typeof row.firstName !== "string"
    || typeof row.subject !== "string" || !row.subject.trim()
    || !Array.isArray(row.items) || row.items.length < 1 || row.items.length > 20) return false
  return row.items.every((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false
    const entry = item as Record<string, unknown>
    return typeof entry.opportunityId === "string" && /^[0-9a-f-]{36}$/i.test(entry.opportunityId)
      && typeof entry.publicTitle === "string" && !!entry.publicTitle.trim()
      && typeof entry.teaserSummary === "string" && !!entry.teaserSummary.trim()
  })
}

async function complete(deliveryId: string, leaseToken: string,
  outcome: "accepted" | "rejected" | "uncertain" | "blocked" | "deferred",
  providerMessageId?: string,
): Promise<DeliveryResult> {
  const { data, error } = await createAdminClient().rpc("d136_complete", {
    p_delivery_id: deliveryId,
    p_lease_token: leaseToken,
    p_outcome: outcome,
    p_provider_message_id: providerMessageId ?? null,
  })
  return !error && ["sent", "suppressed", "review_required", "pending", "failed"].includes(data)
    ? data as DeliveryResult : "failed"
}

async function providerOutcome(idempotencyKey: string): Promise<"rejected" | "uncertain"> {
  const { data, error } = await createAdminClient().from("email_logs")
    .select("provider_outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  return !error && data?.provider_outcome === "rejected" ? "rejected" : "uncertain"
}

/** One durable delivery per recipient/epoch/window. The DB owns membership,
 * lease and current gates; the provider key is stable across conclusive retries. */
export async function deliverDiscoveryDigest(deliveryId: string): Promise<DeliveryResult> {
  const db = createAdminClient()
  const { data, error } = await db.rpc("d136_claim", { p_delivery_id: deliveryId })
  if (error || !data || typeof data !== "object") return "failed"
  const claim = data as Claim
  if (claim.status === "sent") return "sent"
  if (claim.status === "busy") return "busy"
  if (claim.status === "suppressed" || claim.status === "review_required") return claim.status
  if (claim.status === "uncertain") return "uncertain"
  if (claim.status !== "claimed" || !claim.leaseToken || !claim.payloadSha256 || !claim.repreneurId) return "failed"
  const leaseToken = claim.leaseToken
  const payload = claim.payload
  if (!isFrozenPayload(payload)) return complete(deliveryId, leaseToken, "blocked")
  const idempotencyKey = `discovery-digest:${deliveryId}`
  let began = false
  try {
    const result = await sendEmail({
      to: payload.recipientEmail,
      subject: payload.subject,
      repreneurId: claim.repreneurId,
      templateKey: "opportunity_discovery_digest",
      react: DiscoveryDigestEmail({ firstName: payload.firstName, items: payload.items }),
      idempotencyKey,
      beforeProviderAttempt: async () => {
        const { data: authorized, error: beginError } = await db.rpc("d136_begin_provider_attempt", {
          p_delivery_id: deliveryId,
          p_lease_token: leaseToken,
          p_payload_sha256: claim.payloadSha256,
          p_expected_payload: payload,
        })
        if (beginError) throw new Error("Discovery delivery gate unavailable.")
        began = authorized === true
        return began
      },
    })
    if (result.success && result.resendId) {
      return complete(deliveryId, leaseToken, "accepted", result.resendId)
    }
    if (!began && (result.providerOutcome === "blocked" || result.providerOutcome === "fenced")) {
      return complete(deliveryId, leaseToken, "blocked")
    }
    if (!began && result.providerOutcome === "deferred") {
      return complete(deliveryId, leaseToken, "deferred")
    }
    const outcome = await providerOutcome(idempotencyKey)
    return complete(deliveryId, leaseToken, outcome)
  } catch {
    // A DB failure after the provider boundary is never a no-I/O retry.
    if (began) await complete(deliveryId, leaseToken, "uncertain").catch(() => null)
    return "failed"
  }
}

async function dueIds(status: "pending" | "failed" | "claimed", limit: number, now: string) {
  const db = createAdminClient()
  const base = db.from("discovery_digest_deliveries")
    .select("id")
    .eq("status", status)
    .order("updated_at", { ascending: true })
    .limit(limit)
  const { data, error } = status === "claimed"
    ? await base.lt("lease_expires_at", now)
    : await base
  if (error) throw new Error("Could not read discovery digest queue.")
  return (data ?? []).map((row) => row.id as string)
}

/** Daily cron does a bounded amount of work. Every remaining window/delivery
 * stays durable for a later run, and explicit review rows are reported. */
export async function runDueDiscoveryDigests(limit = 4, budgetMs = 40_000) {
  const safeLimit = Math.min(4, Math.max(1, Math.floor(limit)))
  const started = Date.now()
  const db = createAdminClient()
  let materialized = 0
  let materializationReview = 0
  let windowBatchLimitReached = false
  for (let index = 0; index < 2 && Date.now() - started < budgetMs; index++) {
    const { data, error } = await db.rpc("d136_materialize_next_window")
    if (error) throw new Error("Could not materialize discovery digest window.")
    if (data?.status === "review_required") materializationReview++
    if (["ready", "empty", "review_required"].includes(data?.status)) materialized++
    else break
    if (index === 1) windowBatchLimitReached = true
  }
  const now = new Date().toISOString()
  const [pending, failed, claimed] = await Promise.all([
    dueIds("pending", safeLimit, now),
    dueIds("failed", safeLimit, now),
    dueIds("claimed", safeLimit, now),
  ])
  const selected: string[] = []
  for (let index = 0; index < safeLimit && selected.length < safeLimit; index++) {
    for (const bucket of [pending, claimed, failed]) {
      if (bucket[index] && selected.length < safeLimit) selected.push(bucket[index])
    }
  }
  let sent = 0
  let uncertain = 0
  let failedCount = 0
  let processed = 0
  for (const id of selected) {
    if (Date.now() - started >= budgetMs) break
    const result = await deliverDiscoveryDigest(id)
    processed++
    if (result === "sent") sent++
    if (result === "uncertain") uncertain++
    if (result === "failed") failedCount++
  }
  const counters = await Promise.all([
    db.from("discovery_digest_deliveries").select("id", { head: true, count: "exact" }).eq("status", "review_required"),
    db.from("discovery_digest_deliveries").select("id", { head: true, count: "exact" }).eq("status", "pending"),
    db.from("discovery_digest_deliveries").select("id", { head: true, count: "exact" }).eq("status", "failed"),
    db.from("discovery_digest_deliveries").select("id", { head: true, count: "exact" }).eq("status", "claimed"),
    db.from("discovery_digest_windows").select("id", { head: true, count: "exact" }).eq("status", "review_required"),
  ])
  if (counters.some(({ error }) => error)) throw new Error("Could not read discovery digest backlog counts.")
  return { materialized, materializationReview, windowBatchLimitReached, processed,
    sent, uncertain, failed: failedCount, reviewRequired: counters[0].count ?? 0,
    pendingBacklog: counters[1].count ?? 0, failedBacklog: counters[2].count ?? 0,
    claimedBacklog: counters[3].count ?? 0, windowReviewBacklog: counters[4].count ?? 0,
    budgetDeferred: selected.length - processed }
}
