import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => void) => callback()),
}))

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return { ...actual, after: mocks.after }
})

import { captureWaveServerEvent, queueWaveServerEvent } from "@/lib/telemetry/server"

const capture = {
  distinctId: "019fd674-9442-7000-a255-fa06c75772d7",
  event: "wave_action_succeeded" as const,
  properties: {
    route_template: "/portal/deals/019fd674-9442-7000-a255-fa06c75772d8",
    surface: "repreneur" as const,
    role: "repreneur" as const,
    workflow: "portal_pursuit" as const,
    action: "upload" as const,
    outcome: "success" as const,
  },
}

describe("server-confirmed WAVE telemetry", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("swallows transport failures so a committed workflow is unaffected", async () => {
    vi.stubEnv("POSTHOG_ENABLED", "true")
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_wave_project_token_1234567890")
    vi.stubEnv("POSTHOG_ENVIRONMENT", "production")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")))

    await expect(captureWaveServerEvent(capture)).resolves.toBe(false)
  })

  it("queues a sanitized capture after the request response lifecycle", async () => {
    expect(queueWaveServerEvent(capture)).toBe(true)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    await expect(mocks.after.mock.calls[0]?.[0]()).resolves.toBeUndefined()
  })

  it("rejects event names outside the runtime allowlist", async () => {
    vi.stubEnv("POSTHOG_ENABLED", "true")
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_wave_project_token_1234567890")
    vi.stubEnv("POSTHOG_ENVIRONMENT", "production")
    const transport = vi.fn()
    vi.stubGlobal("fetch", transport)

    await expect(captureWaveServerEvent({
      ...capture,
      event: "private_record_exported",
    } as never)).resolves.toBe(false)
    expect(transport).not.toHaveBeenCalled()
  })

  it("swallows queue failures before they can affect product work", () => {
    mocks.after.mockImplementationOnce(() => {
      throw new Error("request context closed")
    })

    expect(queueWaveServerEvent(capture)).toBe(false)
  })
})
