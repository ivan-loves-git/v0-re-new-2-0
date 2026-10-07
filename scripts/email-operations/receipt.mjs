import { createHash } from "node:crypto"
import { PROJECT } from "./project.mjs"
import { inspectResend } from "./preflight.mjs"
import { readJson } from "./http.mjs"

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
function sameAddresses(actual, expected) {
  return Array.isArray(actual) && actual.every(address => typeof address === "string")
    && JSON.stringify(actual.map(address => address.toLowerCase()).sort()) === JSON.stringify([...expected].sort())
}

export async function verifyQaReceipt(env, reviewId, fetchImpl) {
  const result = { schema: 1, command: "receipt", readOnly: true, reviewId }
  const resend = await inspectResend(env, fetchImpl)
  if (resend.state !== "matched") return { ...result, state: "blocked", reason: "resend_project_not_proven" }
  const readRows = (table, key, id, select) => {
    const url = new URL(`/rest/v1/${table}`, PROJECT.sourceUrl)
    url.search = new URLSearchParams({ select, [key]: `eq.${id}` }).toString()
    return readJson(url.href, env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl)
  }
  const review = await readRows("staff_email_reviews", "id", reviewId, "id,state,source_kind,recipient_email,provider_message_id,subject,body_text")
  if (review.state !== "readable" || !Array.isArray(review.value) || review.value.length !== 1) {
    return { ...result, state: "unavailable", reason: "controlled_review_unavailable" }
  }
  const row = review.value[0]
  if (!row || typeof row !== "object") return { ...result, state: "unavailable", reason: "controlled_review_unavailable" }
  if (row.id !== reviewId || row.state !== "sent" || row.source_kind !== "business" || row.recipient_email !== env.QA_PRIMARY_EMAIL ||
    !uuid.test(row.provider_message_id ?? "") || typeof row.subject !== "string" || !row.subject.startsWith("[TEST]") || typeof row.body_text !== "string") {
    return { ...result, state: "blocked", reason: "row_is_not_a_controlled_sent_qa_review" }
  }
  const messageId = row.provider_message_id
  const [provider, history, facts] = await Promise.all([
    readJson(`https://api.resend.com/emails/${messageId}`, env.RESEND_API_KEY, fetchImpl),
    readRows("email_operations_history", "provider_message_id", messageId, "provider_message_id,subject,body_text,cc,status"),
    readRows("email_provider_events", "provider_message_id", messageId, "event_type,recipient_kind"),
  ])
  if ([provider, history, facts].some(read => read.state !== "readable") ||
    !provider.value || typeof provider.value !== "object" || Array.isArray(provider.value) ||
    !Array.isArray(history.value) || history.value.some(row => !row || typeof row !== "object") ||
    !Array.isArray(facts.value) || facts.value.some(event => !event || typeof event !== "object")) {
    return { ...result, state: "unavailable", reason: "receipt_or_retained_facts_unavailable" }
  }
  const actual = provider.value
  const fromAddress = typeof actual.from === "string" ? (actual.from.match(/<([^<>]+)>$/)?.[1] ?? actual.from) : ""
  const envelopeMatches = actual.id === messageId && sameAddresses(actual.to, [env.QA_PRIMARY_EMAIL])
    && sameAddresses(actual.cc, PROJECT.businessCc) && fromAddress.split("@").at(-1) === PROJECT.businessDomain.name
  const copyMatches = actual.subject === row.subject && actual.text === row.body_text
  const retained = history.value[0]
  const historyMatches = history.value.length === 1 && retained.provider_message_id === messageId
    && retained.subject === row.subject && retained.body_text === row.body_text && sameAddresses(retained.cc, PROJECT.businessCc)
  const primaryEvents = facts.value.filter(event => event.recipient_kind === "primary").map(event => event.event_type)
  const delivery = primaryEvents.some(event => ["email.bounced", "email.failed", "email.complained"].includes(event)) ? "failed"
    : primaryEvents.includes("email.delivered") ? "delivered" : primaryEvents.includes("email.sent") ? "pending" : "unknown"
  return {
    ...result, messageId, copyMatches, envelopeMatches, historyMatches, delivery,
    state: !copyMatches || !envelopeMatches || !historyMatches ? "failed"
      : delivery === "delivered" ? "verified" : delivery === "unknown" ? "unavailable" : delivery,
    retainedTextSha256: createHash("sha256").update(row.body_text).digest("hex"),
    eventCount: facts.value.length,
  }
}
