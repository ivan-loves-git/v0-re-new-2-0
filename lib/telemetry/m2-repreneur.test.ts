import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  opaqueId: vi.fn(() => "019fd674-9442-7000-a255-fa06c75772d7"),
  queue: vi.fn(),
}))

vi.mock("@/lib/telemetry/identity", () => ({ getOpaqueTelemetryUserId: mocks.opaqueId }))
vi.mock("@/lib/telemetry/server", () => ({ queueWaveServerEvent: mocks.queue }))

import { queueM2RepreneurEvent, queueM2StaffPursuitEvent } from "@/lib/telemetry/m2-repreneur"

describe("M2 repreneur telemetry vocabulary", () => {
  it("maps fixed lifecycle metadata to the existing safe event contract", () => {
    queueM2RepreneurEvent({
      userId: "raw-authentication-id",
      routeTemplate: "/portal/deals/:matchId",
      workflow: "portal_pursuit",
      action: "upload",
      outcome: "validation_error",
      errorCode: "validation_failed",
    })

    expect(mocks.opaqueId).toHaveBeenCalledWith("raw-authentication-id")
    expect(mocks.queue).toHaveBeenCalledWith({
      distinctId: "019fd674-9442-7000-a255-fa06c75772d7",
      event: "wave_validation_failed",
      properties: expect.objectContaining({
        route_template: "/portal/deals/:matchId",
        surface: "repreneur",
        role: "repreneur",
        workflow: "portal_pursuit",
        action: "upload",
        outcome: "validation_error",
        error_code: "validation_failed",
      }),
    })
  })

  it("does not accept entity or content parameters for staff pursuit events", () => {
    queueM2StaffPursuitEvent({ userId: "raw-staff-id", action: "confirm", outcome: "success" })

    expect(mocks.queue).toHaveBeenLastCalledWith({
      distinctId: "019fd674-9442-7000-a255-fa06c75772d7",
      event: "wave_action_succeeded",
      properties: {
        route_template: "/opportunities/:id",
        surface: "staff",
        role: "staff",
        workflow: "portal_pursuit",
        action: "confirm",
        outcome: "success",
      },
    })
  })
})
