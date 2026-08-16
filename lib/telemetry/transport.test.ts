import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("WAVE PostHog transport wiring", () => {
  it("installs the isolated browser transport and forces masked session recording", () => {
    const provider = source("lib/telemetry/provider.tsx")
    const config = source("lib/telemetry/posthog-config.ts")

    expect(provider).toContain("posthog.init")
    expect(provider).toContain("installWaveTelemetryTransport")
    expect(provider).toContain("onWaveTelemetryTransportReady")
    expect(provider).toContain("startSessionRecording(WAVE_REPLAY_START_OVERRIDE)")
    expect(config).toContain('api_host: POSTHOG_EU_INGESTION_HOST')
    expect(config).toContain('maskTextSelector: "*"')
    expect(config).toContain("maskAllInputs: true")
    expect(config).toContain("recordHeaders: false")
    expect(config).toContain("recordBody: false")
    expect(config).toContain("capture_console_errors: true")
    expect(config).toContain("network_timing: true")
    expect(provider).toContain("posthog.stopSessionRecording()")
    expect(provider).toContain("posthog.opt_out_capturing()")
    expect(provider).not.toContain("posthog.opt_in_capturing")
    expect(provider).toContain("options?.sendInstantly ? { send_instantly: true } : undefined")
  })

  it("delivers only metadata from the server after the ledger completes", () => {
    const transport = source("lib/telemetry/server.ts")
    const route = source("app/api/wave-ai/generate/route.ts")
    const completion = route.indexOf("await completeWaveAiRun")
    const deferredCapture = route.indexOf("after(async () =>", completion)

    expect(transport).toContain("POSTHOG_PROJECT_TOKEN")
    expect(transport).toContain("/capture/")
    expect(transport).toContain("$geoip_disable: true")
    expect(transport).not.toContain("generated_content")
    expect(transport).not.toContain("request_body")
    expect(transport).not.toContain("response_body")
    expect(completion).toBeGreaterThan(-1)
    expect(deferredCapture).toBeGreaterThan(completion)
    expect(route.indexOf("captureWaveAiGeneration", deferredCapture)).toBeGreaterThan(deferredCapture)
  })

  it("captures the requested, rendered, outcome, and feedback lifecycle without content", () => {
    const tool = source("components/wave-ai/wave-ai-tool.tsx")
    for (const event of [
      "wave_ai_generation_requested",
      "wave_ai_generation_rendered",
      "wave_ai_outcome_recorded",
      "wave_ai_feedback_submitted",
    ]) {
      expect(tool).toContain(`captureWaveEvent(\"${event}\"`)
    }
    expect(tool).not.toMatch(/captureWaveEvent\([\s\S]{0,500}(subject|body|customInstructions)/)
  })
})
