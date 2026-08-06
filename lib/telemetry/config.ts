import { BUILD_HASH, BUILD_NUMBER } from "@/lib/version"
import type { WaveEnvironment } from "@/lib/telemetry/contract"
import { sanitizeRelease } from "@/lib/telemetry/privacy"

export const POSTHOG_EU_INGESTION_HOST = "https://eu.i.posthog.com"
export const POSTHOG_EU_UI_HOST = "https://eu.posthog.com"

const ENVIRONMENTS = new Set<WaveEnvironment>([
  "production",
  "preview",
  "development",
  "test",
  "local",
])

export interface ClientTelemetryConfig {
  enabled: boolean
  projectToken: string | null
  environment: WaveEnvironment
  release: string
  isTest: boolean
}

export type ServerTelemetryConfig = ClientTelemetryConfig

interface ClientTelemetryEnvironment {
  enabled?: string
  projectToken?: string
  environment?: string
  isTest?: string
  buildNumber?: string
  buildHash?: string
}

type ServerTelemetryEnvironment = ClientTelemetryEnvironment

function normalizeEnvironment(value: string | undefined): WaveEnvironment {
  return value && ENVIRONMENTS.has(value as WaveEnvironment)
    ? (value as WaveEnvironment)
    : "local"
}

function normalizeToken(value: string | undefined) {
  const token = value?.trim()
  return token && /^phc_[A-Za-z0-9_-]+$/.test(token) ? token : null
}

export function resolveClientTelemetryConfig(
  input: ClientTelemetryEnvironment,
): ClientTelemetryConfig {
  const environment = normalizeEnvironment(input.environment)
  const projectToken = normalizeToken(input.projectToken)
  return {
    enabled: input.enabled === "true" && projectToken !== null,
    projectToken,
    environment,
    release: sanitizeRelease(
      `${input.buildNumber || "0"}.${input.buildHash || "dev"}`,
    ),
    isTest: input.isTest === "true" || environment !== "production",
  }
}

export function getClientTelemetryConfig() {
  return resolveClientTelemetryConfig({
    enabled: process.env.NEXT_PUBLIC_POSTHOG_ENABLED,
    projectToken: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    environment: process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT,
    isTest: process.env.NEXT_PUBLIC_POSTHOG_IS_TEST,
    buildNumber: BUILD_NUMBER,
    buildHash: BUILD_HASH,
  })
}

export function resolveServerTelemetryConfig(
  input: ServerTelemetryEnvironment,
): ServerTelemetryConfig {
  return resolveClientTelemetryConfig(input)
}
