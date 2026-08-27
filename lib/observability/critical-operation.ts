import "server-only"

import { randomUUID } from "node:crypto"
import { scheduleCriticalOperationAlert } from "@/lib/observability/critical-operation-alert"

export type CriticalOperationName =
  | "opportunity.create"
  | "opportunity.update"
  | "pursuit.journey_action"
  | "pursuit.start"
  | "pursuit.signed_nda_upload"
  | "portal.memo_download"
  | "portal.nda_template_download"
  | "portal.staff_preview_memo_download"
  | "email.repreneur_send"
  | "email.password_reset_send"
  | "email.ma_source_send"
  | "email.memo_notification"
  | "email.resend_webhook"
  | "cron.abandoned_forms"
  | "cron.abandoned_reminders"
  | "cron.interview_reminders"
  | "cron.booking_reminders"
  | "cron.stale_leads"
  | "cron.private_upload_cleanup"

export type CriticalOperationErrorCategory =
  | "authorization_denied"
  | "configuration_error"
  | "internal_error"
  | "not_found"
  | "persistence_failed"
  | "precondition_failed"
  | "provider_pending"
  | "provider_rejected"
  | "provider_unavailable"
  | "signature_invalid"
  | "storage_failed"
  | "validation_failed"

export type RuntimeEnvironment =
  | "test"
  | "development"
  | "preview"
  | "production"

interface CriticalOperationBaseEvent {
  event: "wave_critical_operation"
  schema_version: 1
  operation: CriticalOperationName
  request_id: string
  environment: RuntimeEnvironment
  release: string
}

type CriticalOperationEvent = CriticalOperationBaseEvent &
  (
    | { stage: "start" }
    | { stage: "success"; duration_ms: number }
    | {
        stage: "failure"
        duration_ms: number
        error_category: CriticalOperationErrorCategory
      }
  )

export interface CriticalOperationTrace {
  success(): void
  failure(category: CriticalOperationErrorCategory): void
  failOnThrow<T>(
    work: () => Promise<T>,
    category?: CriticalOperationErrorCategory,
  ): Promise<T>
}

function runtimeEnvironment(): RuntimeEnvironment {
  if (process.env.NODE_ENV === "test") return "test"
  if (process.env.VERCEL_ENV === "preview") return "preview"
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "production"
  }
  return "development"
}

function runtimeRelease() {
  const candidate = (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_BUILD_VERSION ??
    ""
  )
    .trim()
    .slice(0, 80)
  return /^(?:[a-f0-9]{7,64}|[0-9]+\.[a-f0-9]{7,64})$/i.test(candidate)
    ? candidate
    : ""
}

function emit(event: CriticalOperationEvent) {
  try {
    const serialized = JSON.stringify(event)
    if (event.stage === "failure") console.error(serialized)
    else console.info(serialized)
  } catch {
    // Runtime diagnostics are best-effort and must never alter product work.
  }
}

function boundedDuration(startedAt: number) {
  return Math.min(600_000, Math.max(0, Math.round(Date.now() - startedAt)))
}

export function startCriticalOperation(
  operation: CriticalOperationName,
): CriticalOperationTrace {
  const startedAt = Date.now()
  const base: CriticalOperationBaseEvent = {
    event: "wave_critical_operation",
    schema_version: 1,
    operation,
    request_id: randomUUID(),
    environment: runtimeEnvironment(),
    release: runtimeRelease(),
  }
  let completed = false

  emit({ ...base, stage: "start" })

  const complete = (
    stage: "success" | "failure",
    errorCategory?: CriticalOperationErrorCategory,
  ) => {
    if (completed) return
    completed = true
    const duration_ms = boundedDuration(startedAt)
    if (stage === "success") {
      emit({ ...base, stage, duration_ms })
      return
    }
    emit({
      ...base,
      stage,
      duration_ms,
      error_category: errorCategory ?? "internal_error",
    })
    scheduleCriticalOperationAlert({
      operation: base.operation,
      error_category: errorCategory ?? "internal_error",
      environment: base.environment,
      release: base.release,
    })
  }

  return {
    success: () => complete("success"),
    failure: (category) => complete("failure", category),
    failOnThrow: async (work, category = "internal_error") => {
      try {
        return await work()
      } catch (error) {
        complete("failure", category)
        throw error
      }
    },
  }
}
