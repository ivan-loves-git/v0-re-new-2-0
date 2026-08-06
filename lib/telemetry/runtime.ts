"use client"

import {
  WAVE_TELEMETRY_SCHEMA_VERSION,
  type WaveEventName,
  type WaveAction,
  type WaveTelemetryProperties,
  type WaveTelemetryRole,
  type WaveWorkflow,
} from "@/lib/telemetry/contract"
import { getClientTelemetryConfig } from "@/lib/telemetry/config"
import {
  isOpaqueUuid,
  normalizeRouteTemplate,
  sanitizeWaveProperties,
  surfaceForRoute,
  workflowForRoute,
} from "@/lib/telemetry/privacy"

const IDENTIFIED_MARKER = "wave_telemetry_identified"

export interface WaveTelemetryTransport {
  capture(
    event: Exclude<WaveEventName, "$ai_generation">,
    properties: Record<string, unknown>,
    options?: { sendInstantly?: boolean },
  ): void
  identify(userId: string, properties: { role: "staff" | "repreneur" }): void
  reset(options: { resetDeviceId: boolean }): void
  register(properties: Record<string, unknown>): void
}

let transport: WaveTelemetryTransport | null = null
let currentRole: WaveTelemetryRole = "anonymous"
let lastPageView: string | null = null

function baseProperties() {
  const config = getClientTelemetryConfig()
  return {
    schema_version: WAVE_TELEMETRY_SCHEMA_VERSION,
    environment: config.environment,
    release: config.release,
    is_test: config.isTest,
    role: currentRole,
  } satisfies WaveTelemetryProperties
}

export function installWaveTelemetryTransport(next: WaveTelemetryTransport) {
  transport = next
  transport.register(
    sanitizeWaveProperties(baseProperties(), {
      environment: getClientTelemetryConfig().environment,
      release: getClientTelemetryConfig().release,
      isTest: getClientTelemetryConfig().isTest,
    }),
  )
  return () => {
    if (transport === next) transport = null
  }
}

export function captureWaveEvent(
  event: Exclude<WaveEventName, "$ai_generation">,
  properties: WaveTelemetryProperties = {},
  options?: { sendInstantly?: boolean },
) {
  const config = getClientTelemetryConfig()
  if (!config.enabled || !transport) return false
  try {
    const safeProperties = sanitizeWaveProperties(
      { ...baseProperties(), ...properties },
      {
        environment: config.environment,
        release: config.release,
        isTest: config.isTest,
      },
    )
    transport.capture(event, safeProperties, options)
    return true
  } catch {
    return false
  }
}

export function capturePageView(pathname: string) {
  const routeTemplate = normalizeRouteTemplate(pathname)
  const dedupeKey = `${routeTemplate}:${currentRole}`
  if (lastPageView === dedupeKey) return false
  lastPageView = dedupeKey
  return captureWaveEvent("wave_page_viewed", {
    route_template: routeTemplate,
    surface: surfaceForRoute(routeTemplate),
    role: currentRole,
    workflow: "navigation",
    action: "navigate",
  })
}

export function captureActionStarted(
  pathname: string,
  action: WaveAction,
  workflow?: WaveWorkflow,
) {
  const routeTemplate = normalizeRouteTemplate(pathname)
  return captureWaveEvent("wave_action_started", {
    route_template: routeTemplate,
    surface: surfaceForRoute(routeTemplate),
    workflow: workflow ?? workflowForRoute(routeTemplate),
    action,
  })
}

export function identifyTelemetryUser(
  userId: string,
  role: Exclude<WaveTelemetryRole, "anonymous">,
) {
  const config = getClientTelemetryConfig()
  if (!config.enabled || !transport || !isOpaqueUuid(userId)) return false
  try {
    currentRole = role
    transport.identify(userId, { role })
    transport.register(
      sanitizeWaveProperties(
        { ...baseProperties(), role },
        {
          environment: config.environment,
          release: config.release,
          isTest: config.isTest,
        },
      ),
    )
    window.localStorage.setItem(IDENTIFIED_MARKER, "true")
    lastPageView = null
    return true
  } catch {
    return false
  }
}

export function resetTelemetryIdentity() {
  currentRole = "anonymous"
  lastPageView = null
  if (!transport) return false
  try {
    transport.reset({ resetDeviceId: true })
    transport.register(baseProperties())
    window.localStorage.removeItem(IDENTIFIED_MARKER)
    return true
  } catch {
    return false
  }
}

export function resetStaleIdentityOnLogin(pathname: string) {
  if (normalizeRouteTemplate(pathname) !== "/auth/login") return false
  try {
    if (window.localStorage.getItem(IDENTIFIED_MARKER) !== "true") return false
  } catch {
    return false
  }
  return resetTelemetryIdentity()
}

export function captureLogoutAndReset(pathname: string) {
  const routeTemplate = normalizeRouteTemplate(pathname)
  captureWaveEvent(
    "wave_action_succeeded",
    {
      route_template: routeTemplate,
      surface: surfaceForRoute(routeTemplate),
      workflow: "authentication",
      action: "logout",
      outcome: "success",
    },
    { sendInstantly: true },
  )
  return resetTelemetryIdentity()
}
