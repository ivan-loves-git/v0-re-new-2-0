import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"
import { render } from "@react-email/render"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  businessCc,
  plainEmailHtml,
  protectedEmailLinks,
  trackingReadiness,
} from "./business-mail-policy"
import type { ReactElement } from "react"
import type { StaffEmailReview } from "@/lib/actions/staff-email-review"

export type BusinessMailInput = {
  to: string
  subject: string
  react: ReactElement
  templateKey: string
  repreneurId?: string
  idempotencyKey?: string
  metadata?: Record<string, unknown>
  sourceContext?: Record<string, unknown>
}
type Approval = { review: StaffEmailReview; token: string; actor: string; entered: boolean }
const approvals = new AsyncLocalStorage<Approval>()
export function businessMailApproval() {
  return approvals.getStore()
}
export async function withBusinessMailApproval<T>(
  approval: Omit<Approval, "entered">,
  run: () => Promise<T>,
) {
  return approvals.run({ ...approval, entered: false }, run)
}
export function configuredBusinessCc(to: string[], existing: string[] = []) {
  // Disposable QA retains the identical envelope rule with explicit fictional staff destinations.
  const canonical =
    process.env.QA_MAIL_MODE === "allowlist"
      ? (process.env.QA_BUSINESS_STAFF_CC ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined
  if (process.env.QA_MAIL_MODE === "allowlist" && canonical?.length !== 2)
    throw new Error("QA requires two explicit fictional staff CC addresses.")
  return businessCc(to, existing, canonical)
}
export function businessTrackingCapability() {
  return trackingReadiness({
    businessFrom: process.env.RESEND_FROM_EMAIL,
    accessFrom: process.env.RESEND_ACCESS_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL,
    verifiedAt: process.env.EMAIL_BUSINESS_TRACKING_VERIFIED_AT,
    trackingDomain: process.env.EMAIL_BUSINESS_TRACKING_DOMAIN,
  })
}

/** A new operation freezes words once. Retrying generation only rejoins that
 * operation, including an old review draft after Auto-send was enabled. */
export async function routeBusinessMail(input: BusinessMailInput) {
  const db = createAdminClient()
  const context = input.sourceContext ?? {}
  const key =
    input.idempotencyKey ??
    `business:${input.templateKey}:${input.repreneurId ?? input.to.toLowerCase()}:${createHash("sha256").update(JSON.stringify(context)).digest("hex")}`
  const approval = approvals.getStore()
  if (approval) {
    if (
      approval.entered ||
      approval.review.source_context?.idempotencyKey !== key ||
      approval.review.template_key !== input.templateKey ||
      approval.review.recipient_email.toLowerCase() !== input.to.trim().toLowerCase()
    ) {
      throw new Error("The current source no longer matches this exact reviewed operation.")
    }
    approval.entered = true
    return {
      review: approval.review,
      token: approval.token,
      key,
      actor: approval.actor,
      queued: false,
      subject: approval.review.subject,
      html: approval.review.retained_html ?? plainEmailHtml(approval.review.body_text),
      text: approval.review.body_text,
    }
  }
  const html = await render(input.react)
  const text = await render(input.react, { plainText: true })
  const { data, error } = await db.rpc("email_business_prepare", {
    p_key: key,
    p_template_key: input.templateKey,
    p_repreneur_id: input.repreneurId ?? null,
    p_recipient: input.to.trim(),
    p_subject: input.subject,
    p_body: text,
    p_html: html,
    p_context: { ...context, idempotencyKey: key, metadata: input.metadata ?? {} },
    p_links: protectedEmailLinks(text),
  })
  if (error || !data?.id)
    throw new Error(
      "The business email could not be prepared safely; no provider request was made.",
    )
  const review = data as StaffEmailReview
  if (review.state === "sent") return { review, key, queued: false, accepted: true as const }
  if (!review.prepared_policy?.auto_send || review.archived_at || review.state !== "pending")
    return { review, key, queued: true }
  const { data: token, error: claimError } = await db.rpc("email_business_reserve", {
    p_review_id: review.id,
    p_version: review.version,
    p_actor: null,
  })
  if (claimError || typeof token !== "string") return { review, key, queued: true }
  return {
    review,
    token,
    key,
    actor: "system",
    queued: false,
    subject: review.subject,
    html: review.retained_html ?? html,
    text: review.body_text,
  }
}

export async function finishBusinessMail(
  operation: { review: StaffEmailReview; token?: string; actor?: string },
  result: { success: boolean; resendId?: string; error?: string; providerOutcome?: string },
) {
  if (!operation.token) return
  const state =
    result.success && result.resendId
      ? "sent"
      : result.providerOutcome === "uncertain"
        ? "uncertain"
        : "failed"
  const { error } = await createAdminClient().rpc("email_business_finish", {
    p_review_id: operation.review.id,
    p_token: operation.token,
    p_state: state,
    p_provider_id: result.success ? (result.resendId ?? null) : null,
    p_error: result.error ?? null,
    p_actor: operation.actor ?? "system",
    p_cc: configuredBusinessCc([operation.review.recipient_email]),
    p_tracking: businessTrackingCapability().verified,
  })
  if (error)
    throw new Error(
      "Provider outcome needs reconciliation on this unchanged operation; do not start another send.",
    )
}
