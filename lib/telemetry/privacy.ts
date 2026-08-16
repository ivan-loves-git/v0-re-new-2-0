import type { CapturedNetworkRequest, CaptureResult, Properties } from "posthog-js"
import {
  WAVE_ACTIONS,
  WAVE_AI_ERROR_CODES,
  WAVE_AI_FEATURES,
  WAVE_AI_STATUSES,
  WAVE_EVENT_NAMES,
  WAVE_ERROR_CODES,
  WAVE_LATENCY_BUCKETS,
  WAVE_OUTCOMES,
  WAVE_ROLES,
  WAVE_SURFACES,
  WAVE_TELEMETRY_SCHEMA_VERSION,
  WAVE_WORKFLOWS,
  type WaveEnvironment,
  type WaveEventName,
  type WaveAction,
  type WaveSurface,
  type WaveTelemetryProperties,
  type WaveWorkflow,
} from "@/lib/telemetry/contract"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_IN_TEXT_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const SAFE_RELEASE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i
const SAFE_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const POSTHOG_PROJECT_TOKEN_PATTERN = /^phc_[A-Za-z0-9_-]{20,}$/
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const TOKEN_PATTERN = /\b(?:sk|phc|re|whsec|eyJ)[-_a-z0-9.]{12,}\b/gi
const LONG_IDENTIFIER_PATTERN = /\b[a-z0-9_-]{20,}\b/gi

const STATIC_ROUTE_SEGMENTS = new Set([
  "account", "analytics", "analytics_op", "analytics_re", "api", "assessment",
  "auth", "c", "contacts", "cron", "dashboard", "dashboard_op", "dashboard_re", "deals",
  "design-system", "details", "edit", "emails", "error", "explore",
  "find", "firms", "forgot-password", "groups", "guide", "guidelines", "import",
  "instructions", "intake-upload-token", "intake-v2", "journey", "login", "ma",
  "ma-workflow", "nda-artifacts", "documents",
  "my-opportunities", "new", "offers", "opportunities", "pipeline",
  "portal", "portal-preview", "profile", "pursuits", "questionnaire", "repreneurs",
  "reset-avatar", "reset-password", "review", "reviews", "roadmap", "routing",
  "scrapbook", "scrapbook-html", "settings", "strategy", "success",
  "tools", "update-journey-stages", "upload-avatar", "upload-cv", "wave-ai",
  "wavy", "webhooks", "welcome",
])

const ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/assessment\/[^/]+\/success\/?$/, "/assessment/:token/success"],
  [/^\/assessment\/[^/]+\/?$/, "/assessment/:token"],
  [/^\/c\/[^/]+\/?$/, "/c/:slug"],
  [/^\/my-opportunities\/[^/]+\/?$/, "/my-opportunities/:matchId"],
  [/^\/offers\/[^/]+\/edit\/?$/, "/offers/:id/edit"],
  [/^\/opportunities\/pursuits\/?$/, "/opportunities/pursuits"],
  [/^\/opportunities\/ma\/?$/, "/opportunities/ma"],
  [/^\/opportunities\/[^/]+\/?$/, "/opportunities/:id"],
  [/^\/portal\/deals\/[^/]+\/?$/, "/portal/deals/:matchId"],
  [/^\/repreneurs\/[^/]+\/questionnaire\/?$/, "/repreneurs/:id/questionnaire"],
  [/^\/repreneurs\/[^/]+\/?$/, "/repreneurs/:id"],
  [/^\/scrapbook-html\/[^/]+\/?$/, "/scrapbook-html/:slot"],
]

const PUBLIC_ROUTE_PREFIXES = ["/assessment", "/c/", "/intake-v2", "/welcome"]
const STAFF_ROUTE_PREFIXES = [
  "/account", "/analytics", "/dashboard", "/emails", "/guide",
  "/journey", "/my-opportunities", "/offers", "/opportunities",
  "/pipeline", "/portal-preview", "/repreneurs", "/scrapbook",
  "/settings", "/strategy", "/tools",
]

const APPLICATION_PROPERTY_KEYS = new Set<keyof WaveTelemetryProperties>([
  "schema_version", "environment", "release", "is_test", "route_template",
  "surface", "role", "workflow", "action", "outcome", "generation_id",
  "trace_id", "prompt_version", "model_key", "latency_bucket", "feature",
  "status", "error_code", "input_tokens", "cached_input_tokens",
  "cache_write_tokens", "output_tokens", "reasoning_tokens",
  "estimated_cost_usd", "latency_ms",
])

const SYSTEM_PROPERTY_KEYS = new Set([
  "$anon_distinct_id", "$browser", "$browser_version", "$current_url",
  "$device_id", "$device_type", "$geoip_disable", "$host",
  "$initial_current_url", "$lib", "$lib_version", "$os", "$os_version",
  "$pathname", "$process_person_profile", "$screen_height", "$screen_width",
  "$session_entry_url", "$session_id", "$viewport_height", "$viewport_width",
  "$window_id", "distinct_id", "token",
])

const AUTOMATIC_EVENT_NAMES = new Set([
  "$exception", "$identify", "$snapshot", "$web_vitals",
])

export interface TelemetryContext {
  environment: WaveEnvironment
  release: string
  isTest: boolean
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value)
}

function finiteNumber(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : undefined
}

export function isOpaqueUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

export function sanitizeRelease(value: unknown) {
  return typeof value === "string" && SAFE_RELEASE_PATTERN.test(value) ? value : "unknown"
}

export function sanitizeVersion(value: unknown) {
  return typeof value === "string" && SAFE_VERSION_PATTERN.test(value) ? value : undefined
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

function stripPathInput(value: string) {
  const noHash = value.split("#", 1)[0] ?? ""
  return noHash.split("?", 1)[0] ?? ""
}

export function normalizeRouteTemplate(pathname: string) {
  const cleanPath = stripPathInput(pathname.trim()) || "/"
  const prefixed = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`
  const collapsed = prefixed.replace(/\/{2,}/g, "/")
  for (const [pattern, template] of ROUTE_PATTERNS) {
    if (pattern.test(collapsed)) return template
  }
  if (collapsed === "/") return "/"
  const segments = collapsed.split("/").filter(Boolean).map((segment) => {
    const decoded = safeDecode(segment)
    if (STATIC_ROUTE_SEGMENTS.has(decoded)) return decoded
    if (/^scrapbook-html-\d+$/.test(decoded)) return decoded
    return ":id"
  })
  return `/${segments.join("/")}`
}

export function surfaceForRoute(routeTemplate: string): WaveSurface {
  if (routeTemplate === "/auth" || routeTemplate.startsWith("/auth/")) return "auth"
  if (routeTemplate === "/routing") return "auth"
  if (routeTemplate === "/portal" || routeTemplate.startsWith("/portal/")) return "repreneur"
  if (STAFF_ROUTE_PREFIXES.some((prefix) => routeTemplate.startsWith(prefix))) return "staff"
  if (routeTemplate === "/" || PUBLIC_ROUTE_PREFIXES.some((prefix) => routeTemplate.startsWith(prefix))) return "public"
  return "public"
}

export function workflowForRoute(pathname: string): WaveWorkflow {
  const routeTemplate = normalizeRouteTemplate(pathname)
  if (routeTemplate === "/auth" || routeTemplate.startsWith("/auth/")) return "authentication"
  if (routeTemplate === "/routing") return "access_request"
  if (routeTemplate.startsWith("/intake")) return "intake"
  if (
    routeTemplate.startsWith("/assessment") ||
    routeTemplate.includes("/questionnaire")
  ) return "assessment"
  if (
    routeTemplate.startsWith("/repreneurs") ||
    routeTemplate.startsWith("/dashboard_re") ||
    routeTemplate.startsWith("/analytics_re")
  ) return "repreneur_management"
  if (
    routeTemplate.startsWith("/opportunities/ma") ||
    routeTemplate.startsWith("/ma") ||
    routeTemplate.startsWith("/deals")
  ) return "ma_advisory"
  if (routeTemplate === "/portal/pursuits" || routeTemplate === "/opportunities/pursuits") return "external_pursuit"
  if (
    routeTemplate.startsWith("/opportunities") ||
    routeTemplate.startsWith("/dashboard_op") ||
    routeTemplate.startsWith("/analytics_op")
  ) return "opportunity_management"
  if (routeTemplate.startsWith("/offers")) return "offer_management"
  if (routeTemplate.startsWith("/pipeline")) return "pipeline"
  if (routeTemplate.startsWith("/emails")) return "email"
  if (routeTemplate.startsWith("/portal/deals")) return "portal_deals"
  if (routeTemplate.startsWith("/portal/profile")) return "portal_profile"
  if (
    routeTemplate.startsWith("/tools/wave-ai") ||
    routeTemplate.startsWith("/wave-ai") ||
    routeTemplate.startsWith("/wavy")
  ) return "wave_ai"
  return "navigation"
}

export function isWaveAction(value: unknown): value is WaveAction {
  return isOneOf(value, WAVE_ACTIONS)
}

export function isWaveWorkflow(value: unknown): value is WaveWorkflow {
  return isOneOf(value, WAVE_WORKFLOWS)
}

export function normalizeUrl(rawUrl: string) {
  try {
    const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl)
    const url = new URL(rawUrl, "https://wave.invalid")
    const normalizedPath = normalizeRouteTemplate(url.pathname)
    return isAbsolute ? `${url.protocol}//${url.host}${normalizedPath}` : normalizedPath
  } catch { return undefined }
}

export function isDeniedDiagnosticUrl(rawUrl: string) {
  try {
    const pathname = new URL(rawUrl, "https://wave.invalid").pathname
    return pathname === "/api/wavy" || pathname.startsWith("/api/wavy/") ||
      pathname === "/api/wave-ai" || pathname.startsWith("/api/wave-ai/") ||
      pathname === "/api/ai" || pathname.startsWith("/api/ai/")
  } catch { return true }
}

export function maskCapturedNetworkRequest(request: CapturedNetworkRequest): CapturedNetworkRequest | null {
  const rawUrl = request.name
  if (!rawUrl || isDeniedDiagnosticUrl(rawUrl)) return null
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) return null
  return {
    ...request,
    name: normalized,
    requestHeaders: undefined,
    requestBody: undefined,
    responseHeaders: undefined,
    responseBody: undefined,
  }
}

export function maskReplayAttribute(name: string, value: string) {
  const normalizedName = name.toLowerCase()
  if (["class", "role", "type", "width", "height", "viewbox"].includes(normalizedName)) return value
  if (["href", "src", "action", "formaction"].includes(normalizedName)) return normalizeUrl(value) ?? "[masked]"
  return "[masked]"
}

export function sanitizeDiagnosticText(value: unknown) {
  if (typeof value !== "string") return "[redacted]"
  return value.replace(EMAIL_PATTERN, "[email]")
    .replace(UUID_IN_TEXT_PATTERN, "[id]")
    .replace(TOKEN_PATTERN, "[secret]")
    .replace(LONG_IDENTIFIER_PATTERN, "[id]")
    .slice(0, 160)
}

function sanitizeSystemProperties(properties: Properties) {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!SYSTEM_PROPERTY_KEYS.has(key)) continue
    if (["$current_url", "$initial_current_url", "$session_entry_url"].includes(key)) {
      const normalized = typeof value === "string" ? normalizeUrl(value) : undefined
      if (normalized) safe[key] = normalized
      continue
    }
    if (key === "$pathname") {
      if (typeof value === "string") safe[key] = normalizeRouteTemplate(value)
      continue
    }
    if (key === "$host") {
      if (typeof value === "string" && value.length <= 255) safe[key] = value
      continue
    }
    if (key === "token") {
      if (typeof value === "string" && POSTHOG_PROJECT_TOKEN_PATTERN.test(value)) safe[key] = value
      continue
    }
    if (["string", "number", "boolean"].includes(typeof value)) safe[key] = value
  }
  return safe
}

function sanitizeApplicationProperties(properties: Properties, context: TelemetryContext) {
  const safe: Record<string, unknown> = {
    schema_version: WAVE_TELEMETRY_SCHEMA_VERSION,
    environment: context.environment,
    release: sanitizeRelease(context.release),
    is_test: context.isTest,
  }
  for (const [key, value] of Object.entries(properties)) {
    if (!APPLICATION_PROPERTY_KEYS.has(key as keyof WaveTelemetryProperties)) continue
    switch (key as keyof WaveTelemetryProperties) {
      case "schema_version": case "environment": case "release": case "is_test": break
      case "route_template": if (typeof value === "string") safe.route_template = normalizeRouteTemplate(value); break
      case "surface": if (isOneOf(value, WAVE_SURFACES)) safe.surface = value; break
      case "role": if (isOneOf(value, WAVE_ROLES)) safe.role = value; break
      case "workflow": if (isOneOf(value, WAVE_WORKFLOWS)) safe.workflow = value; break
      case "action": if (isOneOf(value, WAVE_ACTIONS)) safe.action = value; break
      case "outcome": if (isOneOf(value, WAVE_OUTCOMES)) safe.outcome = value; break
      case "generation_id": case "trace_id": if (isOpaqueUuid(value)) safe[key] = value; break
      case "prompt_version": { const version = sanitizeVersion(value); if (version) safe.prompt_version = version; break }
      case "model_key": if (value === "gpt-5.6-luna") safe.model_key = value; break
      case "latency_bucket": if (isOneOf(value, WAVE_LATENCY_BUCKETS)) safe.latency_bucket = value; break
      case "feature": if (isOneOf(value, WAVE_AI_FEATURES)) safe.feature = value; break
      case "status": if (isOneOf(value, WAVE_AI_STATUSES)) safe.status = value; break
      case "error_code": if (isOneOf(value, [...WAVE_AI_ERROR_CODES, ...WAVE_ERROR_CODES])) safe.error_code = value; break
      case "input_tokens": case "cached_input_tokens": case "cache_write_tokens": case "output_tokens": case "reasoning_tokens": {
        const count = finiteNumber(value, 10_000_000)
        if (count !== undefined) safe[key] = Math.trunc(count)
        break
      }
      case "estimated_cost_usd": { const cost = finiteNumber(value, 10_000); if (cost !== undefined) safe.estimated_cost_usd = cost; break }
      case "latency_ms": { const latency = finiteNumber(value, 3_600_000); if (latency !== undefined) safe.latency_ms = Math.trunc(latency); break }
    }
  }
  return safe
}

export function sanitizeWaveProperties(
  properties: WaveTelemetryProperties,
  context: TelemetryContext,
) {
  return sanitizeApplicationProperties(properties as Properties, context)
}

function sanitizeExceptionFrames(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(-40).map((frame) => {
    if (!frame || typeof frame !== "object") return {}
    const candidate = frame as Record<string, unknown>
    const safe: Record<string, unknown> = {}
    if (typeof candidate.filename === "string") safe.filename = normalizeUrl(candidate.filename) ?? "[redacted]"
    if (typeof candidate.function === "string") safe.function = sanitizeDiagnosticText(candidate.function)
    if (typeof candidate.lineno === "number") safe.lineno = candidate.lineno
    if (typeof candidate.colno === "number") safe.colno = candidate.colno
    if (typeof candidate.in_app === "boolean") safe.in_app = candidate.in_app
    if (typeof candidate.platform === "string") safe.platform = sanitizeDiagnosticText(candidate.platform)
    return safe
  })
}

function sanitizeExceptionList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 5).map((exception) => {
    if (!exception || typeof exception !== "object") return {}
    const candidate = exception as Record<string, unknown>
    const stacktrace = candidate.stacktrace && typeof candidate.stacktrace === "object"
      ? candidate.stacktrace as Record<string, unknown> : null
    return {
      type: sanitizeDiagnosticText(candidate.type),
      value: "[redacted]",
      ...(stacktrace ? { stacktrace: {
        type: sanitizeDiagnosticText(stacktrace.type),
        frames: sanitizeExceptionFrames(stacktrace.frames),
      } } : {}),
    }
  })
}

function sanitizeExceptionEvent(capture: CaptureResult, context: TelemetryContext) {
  return {
    ...capture,
    properties: {
      ...sanitizeSystemProperties(capture.properties),
      ...sanitizeApplicationProperties(capture.properties, context),
      $exception_list: sanitizeExceptionList(capture.properties.$exception_list),
      $exception_level: typeof capture.properties.$exception_level === "string"
        ? sanitizeDiagnosticText(capture.properties.$exception_level) : "error",
    },
    $set: undefined, $set_once: undefined, $unset: undefined,
  }
}

function sanitizeIdentifyEvent(capture: CaptureResult, context: TelemetryContext) {
  const role = capture.$set?.role
  return {
    ...capture,
    properties: {
      ...sanitizeSystemProperties(capture.properties),
      schema_version: WAVE_TELEMETRY_SCHEMA_VERSION,
      environment: context.environment,
      release: sanitizeRelease(context.release),
      is_test: context.isTest,
      ...(isOneOf(role, WAVE_ROLES) && role !== "anonymous" ? { role } : {}),
    },
    $set: isOneOf(role, WAVE_ROLES) && role !== "anonymous" ? { role } : undefined,
    $set_once: undefined, $unset: undefined,
  }
}

function sanitizeWebVitalsEvent(capture: CaptureResult, context: TelemetryContext) {
  const properties: Record<string, unknown> = {
    ...sanitizeSystemProperties(capture.properties),
    schema_version: WAVE_TELEMETRY_SCHEMA_VERSION,
    environment: context.environment,
    release: sanitizeRelease(context.release),
    is_test: context.isTest,
  }
  for (const [key, value] of Object.entries(capture.properties)) {
    if (key.startsWith("$web_vitals_") && typeof value === "number") properties[key] = value
  }
  return { ...capture, properties, $set: undefined, $set_once: undefined, $unset: undefined }
}

export function createBeforeSend(context: TelemetryContext) {
  return (capture: CaptureResult | null): CaptureResult | null => {
    if (!capture) return null
    if ((WAVE_EVENT_NAMES as readonly string[]).includes(capture.event)) {
      return {
        ...capture,
        properties: {
          ...sanitizeSystemProperties(capture.properties),
          ...sanitizeApplicationProperties(capture.properties, context),
        },
        $set: undefined, $set_once: undefined, $unset: undefined,
      }
    }
    if (!AUTOMATIC_EVENT_NAMES.has(capture.event)) return null
    if (capture.event === "$exception") return sanitizeExceptionEvent(capture, context)
    if (capture.event === "$identify") return sanitizeIdentifyEvent(capture, context)
    if (capture.event === "$web_vitals") return sanitizeWebVitalsEvent(capture, context)
    // Replay content is already transformed in-browser by the dedicated masks.
    return capture
  }
}

export function isWaveEventName(value: string): value is WaveEventName {
  return (WAVE_EVENT_NAMES as readonly string[]).includes(value)
}
