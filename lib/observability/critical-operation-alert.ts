import "server-only"

import { after } from "next/server"

import { FROM_EMAIL, FROM_NAME, resend } from "@/lib/email/resend-client"
import { env } from "@/lib/env"
import type {
  CriticalOperationErrorCategory,
  CriticalOperationName,
  RuntimeEnvironment,
} from "@/lib/observability/critical-operation"

const ALERT_WINDOW_MS = 15 * 60 * 1000

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

export function criticalOperationAlertWindow(now: Date) {
  const startMs = Math.floor(now.getTime() / ALERT_WINDOW_MS) * ALERT_WINDOW_MS
  const start = new Date(startMs)
  const end = new Date(startMs + ALERT_WINDOW_MS)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    key: `${start.toISOString().slice(0, 16).replace(/[-:]/g, "")}Z`,
  }
}

function safeAlertLog(
  stage: "scheduled" | "sent" | "provider_failed" | "schedule_failed",
  alert: CriticalOperationFailureAlert,
  windowStart: string,
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
      window_start: windowStart,
    })
    if (stage === "provider_failed" || stage === "schedule_failed") {
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

  const window = criticalOperationAlertWindow(options.now ?? new Date())
  const release = alert.release || "unknown"
  const idempotencyKey = [
    "wave-critical",
    alert.environment,
    alert.operation,
    alert.error_category,
    release,
    window.key,
  ].join("-")
  const send = options.send ?? resend.emails.send
  const schedule = options.schedule ?? ((task) => after(task))

  try {
    schedule(async () => {
      try {
        const { error } = await send(
          {
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: recipient,
            subject: `[WAVE] Critical operation failed: ${alert.operation}`,
            text: [
              "WAVE recorded at least one operational failure.",
              "",
              `Operation: ${alert.operation}`,
              `Category: ${alert.error_category}`,
              `Environment: ${alert.environment}`,
              `Release: ${release}`,
              `Window: ${window.start} to ${window.end}`,
              "",
              "Open the Vercel runtime logs for this operation and time window. This alert intentionally contains no customer or transaction data.",
            ].join("\n"),
          },
          { idempotencyKey },
        )
        safeAlertLog(error ? "provider_failed" : "sent", alert, window.start)
      } catch {
        safeAlertLog("provider_failed", alert, window.start)
      }
    })
    safeAlertLog("scheduled", alert, window.start)
  } catch {
    safeAlertLog("schedule_failed", alert, window.start)
  }
}
