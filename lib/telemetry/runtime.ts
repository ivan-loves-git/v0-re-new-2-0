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
  suspend(): void
}

let transport: WaveTelemetryTransport | null = null
let currentRole: WaveTelemetryRole = "anonymous"
let lastPageView: string | null = null
const transportReadyListeners = new Set<() => void>()

function suspendWaveTelemetry(failedTransport: WaveTelemetryTransport) {
  currentRole = "anonymous"
  lastPageView = null
  try {
    failedTransport.suspend()
  } catch {
    // The in-memory transport is still detached below, so custom events stop.
  }
  if (transport === failedTransport) transport = null
}

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
  for (const listener of transportReadyListeners) listener()
  return () => {
    if (transport === next) transport = null
  }
}

export function onWaveTelemetryTransportReady(listener: () => void) {
  transportReadyListeners.add(listener)
  if (transport) listener()
  return () => {
    transportReadyListeners.delete(listener)
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
    workflow: workflowForRoute(routeTemplate),
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
  const activeTransport = transport
  try {
    // Set the recovery marker before identification so a partial hand-off is
    // repaired on the next login even if a later SDK operation fails.
    window.localStorage.setItem(IDENTIFIED_MARKER, "true")
    activeTransport.identify(userId, { role })
    currentRole = role
    activeTransport.register(
      sanitizeWaveProperties(
        { ...baseProperties(), role },
        {
          environment: config.environment,
          release: config.release,
          isTest: config.isTest,
        },
      ),
    )
    lastPageView = null
    return true
  } catch {
    // If any part of the hand-off fails, prefer losing the analytics chain to
    // leaving a partially identified browser behind.
    currentRole = "anonymous"
    lastPageView = null
    try {
      activeTransport.reset({ resetDeviceId: true })
      activeTransport.register(baseProperties())
      window.localStorage.removeItem(IDENTIFIED_MARKER)
    } catch {
      suspendWaveTelemetry(activeTransport)
    }
    return false
  }
}

export function resetTelemetryIdentity() {
  if (!transport) return false
  const activeTransport = transport
  try {
    activeTransport.reset({ resetDeviceId: true })
    currentRole = "anonymous"
    lastPageView = null
    activeTransport.register(baseProperties())
    window.localStorage.removeItem(IDENTIFIED_MARKER)
    return true
  } catch {
    suspendWaveTelemetry(activeTransport)
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
