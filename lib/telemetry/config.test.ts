import { describe, expect, it } from "vitest"
import { resolveClientTelemetryConfig } from "@/lib/telemetry/config"
import {
  buildPostHogBrowserConfig,
  WAVE_REPLAY_START_OVERRIDE,
} from "@/lib/telemetry/posthog-config"

describe("WAVE telemetry configuration", () => {
  it("is disabled unless both the explicit switch and a valid project token exist", () => {
    expect(resolveClientTelemetryConfig({ enabled: "true" }).enabled).toBe(false)
    expect(
      resolveClientTelemetryConfig({
        enabled: "false",
        projectToken: "phc_wave_project",
      }).enabled,
    ).toBe(false)
    expect(
      resolveClientTelemetryConfig({
        enabled: "true",
        projectToken: "  phc_wave_project  ",
      }),
    ).toMatchObject({ enabled: true, projectToken: "phc_wave_project" })
  })

  it("marks every non-production environment as test traffic", () => {
    expect(
      resolveClientTelemetryConfig({ environment: "preview", isTest: "false" }),
    ).toMatchObject({ environment: "preview", isTest: true })
    expect(
      resolveClientTelemetryConfig({ environment: "production", isTest: "false" }),
    ).toMatchObject({ environment: "production", isTest: false })
  })

  it("pins direct EU ingestion and the locked privacy configuration", () => {
    const resolved = resolveClientTelemetryConfig({
      enabled: "true",
      projectToken: "phc_wave_project",
      environment: "production",
      buildNumber: "1200",
      buildHash: "abc1234",
    })
    const config = buildPostHogBrowserConfig(resolved, { isHttps: true })

    expect(config).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      ui_host: "https://eu.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: true,
      },
      enable_recording_console_log: true,
      capture_performance: { network_timing: true },
      disable_session_recording: false,
      session_recording: {
        maskTextSelector: "*",
        maskAllInputs: true,
        recordHeaders: false,
        recordBody: false,
        recordCrossOriginIframes: false,
      },
    })
    expect(WAVE_REPLAY_START_OVERRIDE).toEqual({
      sampling: true,
      linked_flag: true,
      url_trigger: true,
      event_trigger: true,
    })
  })
})

