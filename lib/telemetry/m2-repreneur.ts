import "server-only"

import { getOpaqueTelemetryUserId } from "@/lib/telemetry/identity"
import { queueWaveServerEvent } from "@/lib/telemetry/server"
import type {
  WaveAction,
  WaveErrorCode,
  WaveOutcome,
  WaveWorkflow,
} from "@/lib/telemetry/contract"

type M2RepreneurTelemetryInput = {
  userId: string
  routeTemplate: "/portal" | "/portal/deals" | "/portal/deals/:matchId"
  workflow: Extract<WaveWorkflow, "portal_access" | "portal_deals" | "portal_pursuit">
  action: WaveAction
  outcome: WaveOutcome
  errorCode?: WaveErrorCode
}

function eventForOutcome(outcome: WaveOutcome) {
  if (outcome === "success" || outcome === "confirmed") return "wave_action_succeeded" as const
  if (outcome === "validation_error") return "wave_validation_failed" as const
  return "wave_action_failed" as const
}

/**
 * The M2 funnel has a deliberately small server-confirmed vocabulary. Callers
 * provide only fixed metadata; the telemetry contract strips anything else.
 */
export function queueM2RepreneurEvent(input: M2RepreneurTelemetryInput) {
  if (!input.userId?.trim()) return
  queueWaveServerEvent({
    distinctId: getOpaqueTelemetryUserId(input.userId),
    event: eventForOutcome(input.outcome),
    properties: {
      route_template: input.routeTemplate,
      surface: "repreneur",
      role: "repreneur",
      workflow: input.workflow,
      action: input.action,
      outcome: input.outcome,
      ...(input.errorCode ? { error_code: input.errorCode } : {}),
    },
  })
}

export function queueM2StaffPursuitEvent(input: {
  userId: string
  action: Extract<WaveAction, "confirm" | "update">
  outcome: WaveOutcome
  errorCode?: WaveErrorCode
}) {
  if (!input.userId?.trim()) return
  queueWaveServerEvent({
    distinctId: getOpaqueTelemetryUserId(input.userId),
    event: eventForOutcome(input.outcome),
    properties: {
      route_template: "/opportunities/:id",
      surface: "staff",
      role: "staff",
      workflow: "portal_pursuit",
      action: input.action,
      outcome: input.outcome,
      ...(input.errorCode ? { error_code: input.errorCode } : {}),
    },
  })
}
