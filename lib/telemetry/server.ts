import "server-only"

import { BUILD_HASH, BUILD_NUMBER } from "@/lib/version"
import type { WaveAiGenerationCapture } from "@/lib/telemetry/contract"
import { buildAiGenerationPayload } from "@/lib/telemetry/ai-payload"
import {
  POSTHOG_EU_INGESTION_HOST,
  resolveServerTelemetryConfig,
} from "@/lib/telemetry/config"

function serverTelemetryConfig() {
  return resolveServerTelemetryConfig({
    enabled: process.env.POSTHOG_ENABLED,
    projectToken: process.env.POSTHOG_PROJECT_TOKEN,
    environment: process.env.POSTHOG_ENVIRONMENT,
    isTest: process.env.POSTHOG_IS_TEST,
    buildNumber: BUILD_NUMBER,
    buildHash: BUILD_HASH,
  })
}

export async function captureWaveAiGeneration(
  capture: WaveAiGenerationCapture,
) {
  const config = serverTelemetryConfig()
  if (!config.enabled || !config.projectToken) return false
  const payload = buildAiGenerationPayload(capture, {
    environment: config.environment,
    release: config.release,
    isTest: config.isTest,
  })
  if (!payload) return false

  try {
    const response = await fetch(`${POSTHOG_EU_INGESTION_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.projectToken,
        event: payload.event,
        properties: {
          ...payload.properties,
          $geoip_disable: true,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    })
    return response.ok
  } catch {
    return false
  }
}
