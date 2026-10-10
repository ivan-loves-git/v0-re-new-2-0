import "server-only"

import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { env } from "@/lib/env"
import type {
  CriticalOperationErrorCategory,
  CriticalOperationName,
  RuntimeEnvironment,
} from "@/lib/observability/critical-operation"

const alertableCategories = new Set<CriticalOperationErrorCategory>([
  "configuration_error",
  "internal_error",
  "persistence_failed",
  "provider_rejected",
  "provider_unavailable",
  "storage_failed",
])

interface CriticalOperationFailureAlert {
  operation: CriticalOperationName
  error_category: CriticalOperationErrorCategory
  environment: RuntimeEnvironment
  release: string
}

type CriticalOperationAlertTask = () => Promise<void>

export type CriticalOperationAlertScheduler = (
  task: CriticalOperationAlertTask,
) => void

type CriticalOperationAlertSender = typeof resend.emails.send

interface CriticalOperationAlertOptions {
  now?: Date
  recipient?: string
  schedule?: CriticalOperationAlertScheduler
  send?: CriticalOperationAlertSender
}

export function isAlertableCriticalOperationFailure(
  category: CriticalOperationErrorCategory,
) {
  return alertableCategories.has(category)
}

function safeAlertLog(
  stage: "scheduled" | "sent" | "provider_failed" | "schedule_failed" | "ledger_unavailable",
  alert: CriticalOperationFailureAlert,
  observedAt: string,
) {
  try {
    const serialized = JSON.stringify({
      event: "wave_critical_operation_alert",
      schema_version: 1,
      stage,
      operation: alert.operation,
      error_category: alert.error_category,
      environment: alert.environment,
      release: alert.release,
      observed_at: observedAt,
    })
    if (stage === "provider_failed" || stage === "schedule_failed" || stage === "ledger_unavailable") {
      console.error(serialized)
    } else {
      console.info(serialized)
    }
  } catch {
    // Alert diagnostics must never alter the product action that already failed.
  }
}

export function scheduleCriticalOperationAlert(
  alert: CriticalOperationFailureAlert,
  options: CriticalOperationAlertOptions = {},
) {
  const recipient = options.recipient ?? env.WAVE_CRITICAL_ALERT_EMAIL
  if (
    alert.environment !== "production" ||
    !recipient ||
    !isAlertableCriticalOperationFailure(alert.error_category)
  ) {
    return
  }

  const observedAt = (options.now ?? new Date()).toISOString()
  const release = alert.release || "unknown"
  const send = options.send ?? resend.emails.send
  const schedule = options.schedule ?? ((task) => after(task))

  try {
    schedule(async () => {
      try {
        const database = createAdminClient()
        const { data, error } = await database.rpc("critical_alert_observe", {
          p_operation: alert.operation,
          p_category: alert.error_category,
          p_environment: alert.environment,
          p_release: release,
          p_from: `${FROM_NAME} <${FROM_EMAIL}>`,
          p_recipient: recipient,
        })
        if (error) throw new Error("incident_ledger_unavailable")
        if (!data) return
        await dispatchNotification(data as IncidentNotification, database, send)
      } catch {
        safeAlertLog("ledger_unavailable", alert, observedAt)
        await sendDegradedWarning(recipient, send, options.now ?? new Date())
      }
    })
    safeAlertLog("scheduled", alert, observedAt)
  } catch {
    safeAlertLog("schedule_failed", alert, observedAt)
  }
}

interface IncidentNotification {
  id: string
  lease_token: string
  idempotency_key: string
  kind: "opening" | "reminder" | "quiet"
  payload: {
    format_version: 1
    environment: RuntimeEnvironment
    operation: CriticalOperationName
    error_category: CriticalOperationErrorCategory
    release: string
    first_failure_at: string
    last_failure_at: string
    failure_count: number
    notice_at: string
    from_email: string
    recipient: string
  }
}

function notificationMessage(notification: IncidentNotification) {
  const payload = notification.payload
  if (payload.format_version !== 1) throw new Error("unsupported_alert_format")
  // V1 is immutable: pending notifications must retain identical provider
  // words across deployments. Add a new version for future copy changes.
  const title = notification.kind === "quiet"
    ? "No further failures observed"
    : notification.kind === "reminder" ? "Incident still active" : "Operational incident"
  return {
    from: payload.from_email,
    to: payload.recipient,
    subject: `[WAVE] ${title}: ${payload.operation}`,
    tags: [{ name: "renew_mail_class", value: "system" }],
    text: [
      notification.kind === "quiet"
        ? `As of ${payload.notice_at}, WAVE has observed no further failures of this kind for at least 24 hours. This does not prove that the underlying issue is fixed or that the operation has run again.`
        : "WAVE recorded an operational failure. Repeated occurrences are grouped into this incident; reminders are limited to once every 24 hours.",
      "",
      `Operation: ${payload.operation}`,
      `Category: ${payload.error_category}`,
      `Environment: ${payload.environment}`,
      `Latest observed release: ${payload.release}`,
      `First failure: ${payload.first_failure_at}`,
      `Last failure: ${payload.last_failure_at}`,
      `Observed failures: ${payload.failure_count}`,
      `Snapshot: ${payload.notice_at}`,
      "",
      "Check Vercel runtime logs for this operation. No customer or transaction data is included.",
    ].join("\n"),
  }
}

type AlertDatabase = ReturnType<typeof createAdminClient>

async function dispatchNotification(
  notification: IncidentNotification,
  database: AlertDatabase,
  send: CriticalOperationAlertSender,
) {
  let accepted = false
  try {
    const { data, error } = await send(notificationMessage(notification), {
      idempotencyKey: notification.idempotency_key,
    })
    if (!error && data?.id) {
      accepted = true
      const { data: completed, error: completionError } = await database.rpc("critical_alert_complete", {
        p_notification_id: notification.id,
        p_lease_token: notification.lease_token,
        p_provider_id: data.id,
      })
      if (completionError || !completed) throw new Error("acceptance_not_recorded")
      safeAlertLog("sent", notification.payload, notification.payload.notice_at)
      return true
    }
  } catch {
    // A lost provider response is uncertain. The ledger only reissues this
    // frozen notification within the provider's idempotency retention window.
  }
  safeAlertLog("provider_failed", notification.payload, notification.payload.notice_at)
  if (!accepted) {
    try {
      await database.rpc("critical_alert_release", {
        p_notification_id: notification.id,
        p_lease_token: notification.lease_token,
      })
    } catch {
      // The durable lease expires; never recursively alert about alerting.
    }
  }
  return false
}

async function sendDegradedWarning(
  recipient: string,
  send: CriticalOperationAlertSender,
  now: Date,
) {
  const day = now.toISOString().slice(0, 10)
  try {
    const { error } = await send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipient,
      subject: "[WAVE] Operational monitoring degraded",
      tags: [{ name: "renew_mail_class", value: "system" }],
      text: [
        "WAVE could not access its operational incident ledger. At least one failure could not be recorded or an incident check could not complete.",
        `Observation day (UTC): ${day}`,
        "Check the Vercel runtime logs. This fallback warning is limited to once per UTC day and contains no customer or transaction data.",
      ].join("\n"),
    }, { idempotencyKey: `wave-monitoring-degraded-production-${day}` })
    if (error) console.error(JSON.stringify({ event: "wave_critical_operation_alert", stage: "fallback_failed" }))
  } catch {
    console.error(JSON.stringify({ event: "wave_critical_operation_alert", stage: "fallback_failed" }))
  }
}

export async function runCriticalOperationAlertCheck() {
  const recipient = env.WAVE_CRITICAL_ALERT_EMAIL
  const production = process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production")
  const result = { sent: 0, failed: 0, unavailable: false }
  if (!production || !recipient) return { ...result, skipped: true }
  try {
    const database = createAdminClient()
    const deadline = Date.now() + 40_000
    // Claim only when ready to dispatch. Pre-claiming a batch could exhaust
    // unattempted notices if the function runs out of time partway through it.
    for (let count = 0; count < 8 && Date.now() < deadline; count++) {
      const { data, error } = await database.rpc("critical_alert_claim_due", {
        p_from: `${FROM_NAME} <${FROM_EMAIL}>`, p_recipient: recipient, p_limit: 1,
      })
      if (error || !Array.isArray(data)) throw new Error("incident_check_unavailable")
      if (data.length === 0) break
      if (await dispatchNotification(data[0] as IncidentNotification, database, resend.emails.send)) result.sent++
      else result.failed++
    }
    return result
  } catch {
    console.error(JSON.stringify({ event: "wave_critical_operation_alert", stage: "ledger_unavailable" }))
    await sendDegradedWarning(recipient, resend.emails.send, new Date())
    return { ...result, unavailable: true }
  }
}
