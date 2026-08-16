"use client"

import { captureWaveEvent } from "@/lib/telemetry/runtime"
import type { WaveAction } from "@/lib/telemetry/contract"

/** A completed UI action is the first unambiguous acknowledgement after an exact retry. */
export function captureExternalPursuitCompleted(
  role: "staff" | "repreneur",
  action: Extract<WaveAction, "submit" | "update" | "upload" | "delete">,
) {
  const staff = role === "staff"
  return captureWaveEvent("wave_action_succeeded", {
    route_template: staff ? "/opportunities/pursuits" : "/portal/pursuits",
    surface: staff ? "staff" : "repreneur",
    role,
    workflow: "external_pursuit",
    action,
    outcome: "success",
  })
}
