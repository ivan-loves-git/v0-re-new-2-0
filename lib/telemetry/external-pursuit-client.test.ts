import { describe, expect, it, vi } from "vitest"

const capture = vi.hoisted(() => vi.fn())
vi.mock("@/lib/telemetry/runtime", () => ({ captureWaveEvent: capture }))
import { captureExternalPursuitCompleted } from "@/lib/telemetry/external-pursuit-client"

describe("External Pursuit completion telemetry", () => {
  it("captures a fixed metadata-only completed action", () => {
    captureExternalPursuitCompleted("repreneur", "upload")
    expect(capture).toHaveBeenCalledWith("wave_action_succeeded", {
      route_template: "/portal/pursuits", surface: "repreneur", role: "repreneur",
      workflow: "external_pursuit", action: "upload", outcome: "success",
    }, { sendInstantly: true })
  })
})
