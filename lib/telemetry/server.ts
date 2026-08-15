import "server-only"

import { after } from "next/server"
import { BUILD_HASH, BUILD_NUMBER } from "@/lib/version"
import type {
  WaveAiGenerationCapture,
  WaveServerEventCapture,
} from "@/lib/telemetry/contract"
import { WAVE_EVENT_NAMES } from "@/lib/telemetry/contract"
import { buildAiGenerationPayload } from "@/lib/telemetry/ai-payload"
import {
  POSTHOG_EU_INGESTION_HOST,
  resolveServerTelemetryConfig,
} from "@/lib/telemetry/config"
import { isOpaqueUuid, sanitizeWaveProperties } from "@/lib/telemetry/privacy"

const SERVER_EVENT_NAMES = new Set(
  WAVE_EVENT_NAMES.filter((event) => event !== "$ai_generation"),
)

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

/**
 * Send a metadata-only event after a business action has already committed.
 * This never controls, delays, or retries the business workflow itself.
 */
export async function captureWaveServerEvent(capture: WaveServerEventCapture) {
  const config = serverTelemetryConfig()
  if (
    !config.enabled ||
    !config.projectToken ||
    !isOpaqueUuid(capture.distinctId) ||
    !SERVER_EVENT_NAMES.has(capture.event)
  ) return false

  const properties = sanitizeWaveProperties(capture.properties, {
    environment: config.environment,
    release: config.release,
    isTest: config.isTest,
  })

  try {
    const response = await fetch(`${POSTHOG_EU_INGESTION_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.projectToken,
        event: capture.event,
        properties: {
          ...properties,
          distinct_id: capture.distinctId,
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

/** Queue telemetry after the response without making product success depend on it. */
export function queueWaveServerEvent(capture: WaveServerEventCapture) {
  try {
    after(async () => {
      await captureWaveServerEvent(capture)
    })
    return true
  } catch {
    return false
  }
}
