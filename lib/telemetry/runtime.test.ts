import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WaveTelemetryTransport } from "@/lib/telemetry/runtime"

const OPAQUE_USER_ID = "019fd674-9442-7000-a255-fa06c75772d7"
const IDENTIFIED_MARKER = "wave_telemetry_identified"

type TransportCall =
  | { type: "capture"; event: string; properties: Record<string, unknown>; options?: { sendInstantly?: boolean } }
  | { type: "identify"; userId: string; properties: { role: "staff" | "repreneur" } }
  | { type: "reset"; options: { resetDeviceId: boolean } }
  | { type: "register"; properties: Record<string, unknown> }
  | { type: "suspend" }

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

function recordingTransport(
  calls: TransportCall[],
  failures: { identify?: boolean; registerAfter?: number; reset?: boolean } = {},
): WaveTelemetryTransport {
  let registerCount = 0
  return {
    capture(event, properties, options) {
      calls.push({ type: "capture", event, properties, options })
    },
    identify(userId, properties) {
      calls.push({ type: "identify", userId, properties })
      if (failures.identify) throw new Error("identify unavailable")
    },
    reset(options) {
      calls.push({ type: "reset", options })
      if (failures.reset) throw new Error("reset unavailable")
    },
    register(properties) {
      registerCount += 1
      calls.push({ type: "register", properties })
      if (failures.registerAfter === registerCount) {
        throw new Error("register unavailable")
      }
    },
    suspend() {
      calls.push({ type: "suspend" })
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true")
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_wave_project")
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENVIRONMENT", "production")
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_IS_TEST", "false")
  vi.stubEnv("NEXT_PUBLIC_BUILD_NUMBER", "1200")
  vi.stubEnv("NEXT_PUBLIC_BUILD_HASH", "abc1234")
  vi.stubGlobal("window", { localStorage: memoryStorage() })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("WAVE telemetry identity lifecycle", () => {
  it("merges the anonymous browser into an opaque staff identity", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(recordingTransport(calls))

    expect(runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")).toBe(true)
    expect(calls).toContainEqual({
      type: "identify",
      userId: OPAQUE_USER_ID,
      properties: { role: "staff" },
    })
    expect(calls.at(-1)).toMatchObject({
      type: "register",
      properties: { role: "staff" },
    })
    expect(window.localStorage.getItem(IDENTIFIED_MARKER)).toBe("true")
  })

  it("labels the External Pursuit page entry with its semantic workflow and de-duplicates refreshes", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(recordingTransport(calls))
    runtime.identifyTelemetryUser(OPAQUE_USER_ID, "repreneur")
    calls.length = 0

    expect(runtime.capturePageView("/portal/pursuits")).toBe(true)
    expect(runtime.capturePageView("/portal/pursuits")).toBe(false)
    expect(calls).toContainEqual(expect.objectContaining({
      type: "capture",
      event: "wave_page_viewed",
      properties: expect.objectContaining({
        workflow: "external_pursuit",
        route_template: "/portal/pursuits",
      }),
    }))
  })

  it("flushes a completed External Pursuit action immediately with only its allowlisted metadata", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const { captureExternalPursuitCompleted } = await import("@/lib/telemetry/external-pursuit-client")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(recordingTransport(calls))
    runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")
    calls.length = 0

    captureExternalPursuitCompleted("staff", "delete")

    expect(calls).toContainEqual({
      type: "capture",
      event: "wave_action_succeeded",
      properties: expect.objectContaining({
        route_template: "/opportunities/pursuits", surface: "staff", role: "staff",
        workflow: "external_pursuit", action: "delete", outcome: "success",
      }),
      options: { sendInstantly: true },
    })
    const completion = calls.find((call) => call.type === "capture" && call.event === "wave_action_succeeded")
    expect(JSON.stringify(completion)).not.toMatch(/dossier|attachment|filename|note|title|company|contact|idempotency/i)
  })

  it("captures logout before resetting to a fresh anonymous identity", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(recordingTransport(calls))
    runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")
    calls.length = 0

    expect(runtime.captureLogoutAndReset("/dashboard")).toBe(true)
    expect(calls[0]).toMatchObject({
      type: "capture",
      event: "wave_action_succeeded",
      properties: {
        role: "staff",
        workflow: "authentication",
        action: "logout",
        outcome: "success",
      },
      options: { sendInstantly: true },
    })
    expect(calls[1]).toEqual({
      type: "reset",
      options: { resetDeviceId: true },
    })
    expect(calls[2]).toMatchObject({
      type: "register",
      properties: { role: "anonymous" },
    })
    expect(window.localStorage.getItem(IDENTIFIED_MARKER)).toBeNull()

    runtime.captureActionStarted("/", "navigate")
    expect(calls.at(-1)).toMatchObject({
      type: "capture",
      properties: { role: "anonymous" },
    })
  })

  it("fails closed when identification cannot complete", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(
      recordingTransport(calls, { identify: true }),
    )

    expect(runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")).toBe(false)
    expect(calls).toContainEqual({
      type: "reset",
      options: { resetDeviceId: true },
    })
    runtime.captureActionStarted("/", "navigate")
    expect(calls.at(-1)).toMatchObject({
      type: "capture",
      properties: { role: "anonymous" },
    })
  })

  it("suspends all telemetry when the logout reset fails", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(
      recordingTransport(calls, { reset: true }),
    )
    runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")
    calls.length = 0

    expect(runtime.resetTelemetryIdentity()).toBe(false)
    expect(window.localStorage.getItem(IDENTIFIED_MARKER)).toBe("true")
    expect(calls.at(-1)).toEqual({ type: "suspend" })
    expect(runtime.captureActionStarted("/dashboard", "navigate")).toBe(false)
    expect(calls.at(-1)).toEqual({ type: "suspend" })
  })

  it("suspends after a partial identify when recovery reset also fails", async () => {
    const runtime = await import("@/lib/telemetry/runtime")
    const calls: TransportCall[] = []
    runtime.installWaveTelemetryTransport(
      recordingTransport(calls, { registerAfter: 2, reset: true }),
    )

    expect(runtime.identifyTelemetryUser(OPAQUE_USER_ID, "staff")).toBe(false)
    expect(calls).toContainEqual({
      type: "identify",
      userId: OPAQUE_USER_ID,
      properties: { role: "staff" },
    })
    expect(calls.at(-1)).toEqual({ type: "suspend" })
    expect(window.localStorage.getItem(IDENTIFIED_MARKER)).toBe("true")
    expect(runtime.captureActionStarted("/dashboard", "navigate")).toBe(false)
  })
})
