"use server"

import { resend, FROM_EMAIL, FROM_NAME, DAILY_EMAIL_LIMIT } from "./resend-client"
import { createAdminClient } from "@/lib/supabase/admin"
import { isMaContactEmailAddressSuppressed } from "@/lib/email/ma-contact-email-authorization"
import { startCriticalOperation } from "@/lib/observability/critical-operation"
import type { EmailTemplateKey, EmailSendResult, EmailLog_Insert } from "@/lib/types/email"
import type { ReactElement } from "react"

interface SendEmailParams {
  to: string
  subject: string
  repreneurId: string
  templateKey: EmailTemplateKey
  react: ReactElement
  metadata?: Record<string, unknown>
  requiresConsent?: boolean // For explicit consent check (overrides template setting)
  /** Optional BCC recipients — used e.g. to copy Bertrand on interview reminders without exposing his email. */
  bcc?: string[]
  /** Stable provider key for safely replaying one logical delivery. */
  idempotencyKey?: string
}

/**
 * Check if we can send more emails today (rate limiting)
 */
async function checkDailyLimit(): Promise<boolean> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const { data } = await supabase.from("email_daily_counts").select("count").eq("date", today).single()

  return !data || data.count < DAILY_EMAIL_LIMIT
}

/**
 * Increment daily email counter
 */
async function incrementDailyCount(): Promise<void> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  const { error } = await supabase.rpc("increment_email_count", {
    target_date: today,
  })
  if (!error) return

  // Fallback if RPC doesn't exist: manual upsert.
  const { data: existing } = await supabase.from("email_daily_counts").select("count").eq("date", today).single()

  if (existing) {
    await supabase
      .from("email_daily_counts")
      .update({ count: existing.count + 1 })
      .eq("date", today)
  } else {
    await supabase.from("email_daily_counts").insert({ date: today, count: 1 })
  }
}

/**
 * Check if repreneur has given marketing consent
 * Only required for marketing emails (abandoned_reminder, high_score_alert, form_step_complete)
 */
async function checkMarketingConsent(repreneurId: string, templateKey: EmailTemplateKey): Promise<boolean> {
  const supabase = createAdminClient()

  // Check if this template requires consent
  const { data: template } = await supabase
    .from("email_templates")
    .select("requires_consent")
    .eq("template_key", templateKey)
    .single()

  if (!template?.requires_consent) {
    return true // Transactional email, no consent needed
  }

  // Check repreneur's consent
  const { data: repreneur } = await supabase
    .from("repreneurs")
    .select("marketing_consent")
    .eq("id", repreneurId)
    .single()

  return repreneur?.marketing_consent === true
}

/**
 * Check if template is active
 */
async function isTemplateActive(templateKey: EmailTemplateKey): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: template } = await supabase
    .from("email_templates")
    .select("is_active")
    .eq("template_key", templateKey)
    .single()

  return template?.is_active !== false
}

/**
 * Log email to database
 */
async function logEmail(log: EmailLog_Insert): Promise<string | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase.from("email_logs").insert(log).select("id").single()

  if (error) {
    return null
  }

  return data.id
}

type IdempotentEmailLog = {
  id: string
  status: string
  resend_id: string | null
  sent_at: string | null
  daily_counted_at: string | null
  provider_attempted_at: string | null
  provider_outcome: "attempting" | "uncertain" | "rejected" | "accepted" | null
}

const terminalEmailStatuses = new Set(["sent", "delivered", "opened", "clicked"])
const ambiguousProviderOutcomes = new Set(["attempting", "uncertain"])
// Resend guarantees an idempotency key for 24 hours. Stop one hour short so a
// delayed retry never crosses the provider boundary while it is in flight.
const PROVIDER_IDEMPOTENCY_SAFE_RETRY_MS = 23 * 60 * 60 * 1000
const UNCERTAIN_DELIVERY_REVIEW_ERROR =
  "Delivery outcome is uncertain beyond the provider retry window. Review the provider record before retrying."

function isAmbiguousDeliveryPastSafeRetryWindow(log: IdempotentEmailLog): boolean {
  if (!log.provider_outcome || !ambiguousProviderOutcomes.has(log.provider_outcome)) return false
  if (!log.provider_attempted_at) return true
  const attemptedAt = Date.parse(log.provider_attempted_at)
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= PROVIDER_IDEMPOTENCY_SAFE_RETRY_MS
}

async function findIdempotentEmailLog(
  idempotencyKey: string,
): Promise<{ log: IdempotentEmailLog | null; error: boolean }> {
  const { data, error } = await createAdminClient()
    .from("email_logs")
    .select("id, status, resend_id, sent_at, daily_counted_at, provider_attempted_at, provider_outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  return { log: data as IdempotentEmailLog | null, error: Boolean(error) }
}

async function getOrCreateIdempotentEmailLog(
  log: EmailLog_Insert,
  idempotencyKey: string,
): Promise<IdempotentEmailLog | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("email_logs")
    .upsert({ ...log, idempotency_key: idempotencyKey }, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id, status, resend_id, sent_at, daily_counted_at, provider_attempted_at, provider_outcome")
    .maybeSingle()

  if (!error && data) return data as IdempotentEmailLog

  // A concurrent insert owns the unique key. Rejoin its one durable log.
  const existing = await findIdempotentEmailLog(idempotencyKey)
  return existing.error ? null : existing.log
}

async function finalizeIdempotentEmailLog(
  emailLogId: string,
  resendId: string | undefined,
  sentAt: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("finalize_idempotent_email_delivery", {
    p_email_log_id: emailLogId,
    p_resend_id: resendId ?? null,
    p_sent_at: sentAt,
    p_target_date: sentAt.slice(0, 10),
  })
  return !error && data === true
}

/**
 * Update email log status
 */
async function updateEmailLogStatus(
  emailLogId: string,
  updates: {
    status?: string
    resend_id?: string
    sent_at?: string
    error_message?: string | null
    provider_attempted_at?: string
    provider_outcome?: "attempting" | "uncertain" | "rejected" | "accepted"
  },
  preserveTerminal = false,
): Promise<boolean> {
  const supabase = createAdminClient()

  const query = supabase.from("email_logs").update(updates).eq("id", emailLogId)
  if (preserveTerminal) {
    const { data, error } = await query.in("status", ["pending", "failed"]).select("id").maybeSingle()
    return !error && Boolean(data)
  }
  const { error } = await query
  return !error
}

/**
 * Main function to send an email
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  const { to, subject, repreneurId, templateKey, react, metadata = {}, bcc, idempotencyKey } = params
  const trace = startCriticalOperation("email.repreneur_send")
  let activeIdempotentEmailLogId: string | null = null
  let providerRequestStarted = false

  try {
    // A provider-confirmed logical delivery is terminal even if the browser or
    // caller lost the response. Rejoin its one durable log before rechecking
    // mutable preconditions such as template state or the daily quota.
    if (idempotencyKey) {
      const existing = await findIdempotentEmailLog(idempotencyKey)
      if (existing.error) {
        trace.failure("internal_error")
        return {
          success: false,
          error: "Could not verify durable email delivery state.",
        }
      }
      if (existing.log && terminalEmailStatuses.has(existing.log.status)) {
        if (!existing.log.daily_counted_at) {
          const finalized = await finalizeIdempotentEmailLog(
            existing.log.id,
            existing.log.resend_id ?? undefined,
            existing.log.sent_at ?? new Date().toISOString(),
          )
          if (!finalized) {
            trace.failure("internal_error")
            return {
              success: false,
              emailLogId: existing.log.id,
              error: "Could not reconcile durable email delivery accounting.",
            }
          }
        }
        trace.success()
        return {
          success: true,
          emailLogId: existing.log.id,
          resendId: existing.log.resend_id ?? undefined,
        }
      }
      if (existing.log && isAmbiguousDeliveryPastSafeRetryWindow(existing.log)) {
        trace.failure("precondition_failed")
        return {
          success: false,
          emailLogId: existing.log.id,
          error: UNCERTAIN_DELIVERY_REVIEW_ERROR,
        }
      }
    }

    // 1. Check if template is active
    const templateActive = await isTemplateActive(templateKey)
    if (!templateActive) {
      trace.failure("precondition_failed")
      return { success: false, error: "Template is disabled" }
    }

    // 2. Check marketing consent if required
    const hasConsent = await checkMarketingConsent(repreneurId, templateKey)
    if (!hasConsent) {
      trace.failure("precondition_failed")
      return { success: false, error: "Marketing consent not granted" }
    }

    // 3. Check daily rate limit
    const withinLimit = await checkDailyLimit()
    if (!withinLimit) {
      trace.failure("precondition_failed")
      return { success: false, error: "Daily email limit reached" }
    }

    // 4. Create or rejoin the one durable log for this logical delivery. The
    // ordinary, non-idempotent path retains its historical best-effort log.
    const emailLogInput: EmailLog_Insert = {
      repreneur_id: repreneurId,
      template_key: templateKey,
      to_email: to,
      subject,
      status: "pending",
      metadata,
    }
    const durableEmailLog = idempotencyKey ? await getOrCreateIdempotentEmailLog(emailLogInput, idempotencyKey) : null
    const emailLogId = idempotencyKey ? (durableEmailLog?.id ?? null) : await logEmail(emailLogInput)

    if (idempotencyKey && !durableEmailLog) {
      trace.failure("internal_error")
      return {
        success: false,
        error: "Could not create durable email delivery state.",
      }
    }

    // The log could have become terminal after the first lookup while a
    // concurrent caller completed. Never issue a second provider request.
    if (durableEmailLog && terminalEmailStatuses.has(durableEmailLog.status)) {
      if (!durableEmailLog.daily_counted_at) {
        const finalized = await finalizeIdempotentEmailLog(
          durableEmailLog.id,
          durableEmailLog.resend_id ?? undefined,
          durableEmailLog.sent_at ?? new Date().toISOString(),
        )
        if (!finalized) {
          trace.failure("internal_error")
          return {
            success: false,
            emailLogId: durableEmailLog.id,
            error: "Could not reconcile durable email delivery accounting.",
          }
        }
      }
      trace.success()
      return {
        success: true,
        emailLogId: durableEmailLog.id,
        resendId: durableEmailLog.resend_id ?? undefined,
      }
    }
    if (durableEmailLog && isAmbiguousDeliveryPastSafeRetryWindow(durableEmailLog)) {
      trace.failure("precondition_failed")
      return {
        success: false,
        emailLogId: durableEmailLog.id,
        error: UNCERTAIN_DELIVERY_REVIEW_ERROR,
      }
    }

    // 5. Enforce the person-level M&A suppression boundary immediately before
    // delivery. Generic/manual paths have no operational-purpose exception.
    const blockedRecipient = (
      await Promise.all(
        [to, ...(bcc ?? [])].map(async (recipient) => ({
          recipient,
          blocked: await isMaContactEmailAddressSuppressed(recipient),
        })),
      )
    ).find((recipient) => recipient.blocked)
    if (blockedRecipient) {
      if (emailLogId) {
        await updateEmailLogStatus(
          emailLogId,
          {
            status: "failed",
            error_message: "M&A contact campaign email suppressed",
          },
          Boolean(idempotencyKey),
        )
      }
      trace.failure("precondition_failed")
      return {
        success: false,
        emailLogId: emailLogId ?? undefined,
        error: "Email blocked because a recipient has opted out of campaign and general outreach.",
      }
    }

    if (durableEmailLog) {
      // An ambiguous retry keeps the timestamp of the first provider attempt;
      // only a conclusive rejection starts a fresh, safe retry window.
      const attemptedAt =
        durableEmailLog.provider_outcome === "rejected" || !durableEmailLog.provider_attempted_at
          ? new Date().toISOString()
          : durableEmailLog.provider_attempted_at
      const attemptPersisted = await updateEmailLogStatus(
        durableEmailLog.id,
        {
          provider_attempted_at: attemptedAt,
          provider_outcome: "attempting",
          error_message: null,
        },
        true,
      )
      if (!attemptPersisted) {
        trace.failure("internal_error")
        return {
          success: false,
          emailLogId: durableEmailLog.id,
          error: "Could not persist the provider delivery attempt.",
        }
      }
      activeIdempotentEmailLogId = durableEmailLog.id
      providerRequestStarted = true
    }

    // 6. Send email via Resend
    const { data, error } = await resend.emails.send(
      {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        ...(bcc && bcc.length > 0 ? { bcc } : {}),
        subject,
        react,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    if (error) {
      if (emailLogId) {
        await updateEmailLogStatus(
          emailLogId,
          {
            status: "failed",
            error_message: error.message,
            ...(idempotencyKey ? { provider_outcome: "rejected" as const } : {}),
          },
          Boolean(idempotencyKey),
        )
      }
      trace.failure("provider_rejected")
      return {
        success: false,
        emailLogId: emailLogId ?? undefined,
        error: error.message,
      }
    }

    if (idempotencyKey && emailLogId && !data?.id) {
      await updateEmailLogStatus(
        emailLogId,
        {
          status: "pending",
          provider_outcome: "uncertain",
          error_message: "Provider returned no conclusive delivery identifier.",
        },
        true,
      )
      trace.failure("provider_unavailable")
      return {
        success: false,
        emailLogId,
        error: "The email provider did not confirm delivery.",
      }
    }

    // 7. Idempotent success finalizes the one log and daily counter in one
    // transaction. If that acknowledgement is lost, the next retry rejoins
    // the same provider key and log; it never invents a second count.
    const sentAt = new Date().toISOString()
    if (idempotencyKey && emailLogId) {
      const finalized = await finalizeIdempotentEmailLog(emailLogId, data?.id, sentAt)
      if (!finalized) {
        await updateEmailLogStatus(
          emailLogId,
          {
            status: "pending",
            provider_outcome: "uncertain",
            error_message: "Provider accepted delivery but durable finalization was inconclusive.",
          },
          true,
        )
        trace.failure("internal_error")
        return {
          success: false,
          emailLogId,
          error: "Email provider accepted delivery, but durable finalization needs retry.",
        }
      }
    } else if (emailLogId) {
      await updateEmailLogStatus(emailLogId, {
        status: "sent",
        resend_id: data?.id,
        sent_at: sentAt,
      })
    }

    // 8. Durable finalization already counted idempotent deliveries exactly
    // once. Ordinary emails keep the existing counter path.
    if (!idempotencyKey) await incrementDailyCount()

    trace.success()
    return {
      success: true,
      emailLogId: emailLogId ?? undefined,
      resendId: data?.id,
    }
  } catch (err) {
    if (providerRequestStarted && activeIdempotentEmailLogId) {
      try {
        await updateEmailLogStatus(
          activeIdempotentEmailLogId,
          {
            status: "pending",
            provider_outcome: "uncertain",
            error_message: "Provider request outcome is uncertain.",
          },
          true,
        )
      } catch {
        // The persisted `attempting` state is conservative: after the safe
        // window it blocks a blind resend until staff review.
      }
    }
    trace.failure("internal_error")
    return {
      success: false,
      emailLogId: activeIdempotentEmailLogId ?? undefined,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Direct email send without logging (for testing purposes)
 */
export async function sendEmailDirect(params: {
  to: string
  subject: string
  react: ReactElement
  idempotencyKey?: string
}): Promise<{ success: boolean; resendId?: string; error?: string }> {
  const { to, subject, react, idempotencyKey } = params
  const trace = startCriticalOperation("email.repreneur_send")

  try {
    if (await isMaContactEmailAddressSuppressed(to)) {
      trace.failure("precondition_failed")
      return {
        success: false,
        error: "Email blocked because this contact has opted out of campaign and general outreach.",
      }
    }

    const { data, error } = await resend.emails.send(
      {
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        react,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    )

    if (error) {
      trace.failure("provider_rejected")
      return { success: false, error: error.message }
    }

    trace.success()
    return { success: true, resendId: data?.id }
  } catch (err) {
    trace.failure("provider_unavailable")
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Check if an email was already sent to avoid duplicates
 * Useful for preventing re-sending welcome emails, etc.
 * @param repreneurId - The repreneur to check
 * @param templateKey - The email template type
 * @param withinMinutes - Optional: only check emails sent within this time window
 */
export async function wasEmailSent(
  repreneurId: string,
  templateKey: EmailTemplateKey,
  withinMinutes?: number,
): Promise<boolean> {
  const supabase = createAdminClient()

  let query = supabase
    .from("email_logs")
    .select("id")
    .eq("repreneur_id", repreneurId)
    .eq("template_key", templateKey)
    .in("status", ["sent", "delivered", "opened", "clicked"])

  // Add time filter if specified
  if (withinMinutes) {
    const cutoffTime = new Date()
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes)
    query = query.gte("sent_at", cutoffTime.toISOString())
  }

  const { data } = await query.limit(1)

  return (data?.length ?? 0) > 0
}

/**
 * Get email statistics for analytics
 */
export async function getEmailStats(
  dateFrom?: Date,
  dateTo?: Date,
): Promise<{
  total: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
}> {
  const supabase = createAdminClient()

  let query = supabase.from("email_logs").select("status")

  if (dateFrom) {
    query = query.gte("created_at", dateFrom.toISOString())
  }
  if (dateTo) {
    query = query.lte("created_at", dateTo.toISOString())
  }

  const { data } = await query

  if (!data) {
    return {
      total: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      failed: 0,
    }
  }

  return {
    total: data.length,
    delivered: data.filter((e) => ["delivered", "opened", "clicked"].includes(e.status)).length,
    opened: data.filter((e) => ["opened", "clicked"].includes(e.status)).length,
    clicked: data.filter((e) => e.status === "clicked").length,
    bounced: data.filter((e) => e.status === "bounced").length,
    failed: data.filter((e) => e.status === "failed").length,
  }
}
