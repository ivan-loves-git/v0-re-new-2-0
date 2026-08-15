export const WAVE_TELEMETRY_SCHEMA_VERSION = "1" as const

export const WAVE_EVENT_NAMES = [
  "wave_page_viewed",
  "wave_action_started",
  "wave_action_succeeded",
  "wave_action_failed",
  "wave_validation_failed",
  "wave_auth_succeeded",
  "wave_auth_failed",
  "wave_ai_generation_requested",
  "$ai_generation",
  "wave_ai_generation_rendered",
  "wave_ai_outcome_recorded",
  "wave_ai_feedback_submitted",
] as const

export type WaveEventName = (typeof WAVE_EVENT_NAMES)[number]

export const WAVE_SURFACES = [
  "public",
  "auth",
  "staff",
  "repreneur",
] as const

export type WaveSurface = (typeof WAVE_SURFACES)[number]

export const WAVE_ROLES = ["anonymous", "staff", "repreneur"] as const

export type WaveTelemetryRole = (typeof WAVE_ROLES)[number]

export const WAVE_WORKFLOWS = [
  "authentication",
  "access_request",
  "intake",
  "assessment",
  "repreneur_management",
  "opportunity_management",
  "ma_advisory",
  "pipeline",
  "offer_management",
  "email",
  "portal_deals",
  "portal_profile",
  "portal_access",
  "portal_pursuit",
  "wave_ai",
  "navigation",
  "unknown",
] as const

export type WaveWorkflow = (typeof WAVE_WORKFLOWS)[number]

export const WAVE_ACTIONS = [
  "sign_in",
  "logout",
  "request_access",
  "submit",
  "save",
  "update",
  "delete",
  "upload",
  "download",
  "send",
  "generate",
  "render",
  "edit",
  "copy",
  "confirm",
  "express_interest",
  "decline",
  "open",
  "navigate",
  "feedback",
  "discard",
  "access",
] as const

export type WaveAction = (typeof WAVE_ACTIONS)[number]

export const WAVE_OUTCOMES = [
  "success",
  "failure",
  "validation_error",
  "rejected",
  "cancelled",
  "useful",
  "not_useful",
  "copied",
  "sent",
  "confirmed",
  "discarded",
  "missing_session",
  "unexpected_error",
] as const

export type WaveOutcome = (typeof WAVE_OUTCOMES)[number]

/**
 * Product-level categories only. They deliberately describe the class of a
 * failure without carrying a provider response, a record identifier, or any
 * user-entered text.
 */
export const WAVE_ERROR_CODES = [
  "access_denied",
  "validation_failed",
  "unavailable",
  "persistence_failed",
  "notification_failed",
  "upload_failed",
  "internal_error",
] as const

export type WaveErrorCode = (typeof WAVE_ERROR_CODES)[number]

export const WAVE_AI_FEATURES = [
  "email_draft",
  "next_action",
  "match_review",
] as const

export type WaveAiFeature = (typeof WAVE_AI_FEATURES)[number]

export const WAVE_AI_STATUSES = ["succeeded", "failed"] as const

export type WaveAiStatus = (typeof WAVE_AI_STATUSES)[number]

export const WAVE_AI_ERROR_CODES = [
  "rate_limited",
  "provider_timeout",
  "provider_rate_limited",
  "provider_authentication",
  "provider_unavailable",
  "invalid_output",
  "ledger_unavailable",
  "invalid_request",
  "internal_error",
] as const

export type WaveAiErrorCode = (typeof WAVE_AI_ERROR_CODES)[number]

export const WAVE_LATENCY_BUCKETS = [
  "under_1s",
  "1s_to_3s",
  "3s_to_10s",
  "10s_to_30s",
  "over_30s",
] as const

export type WaveLatencyBucket = (typeof WAVE_LATENCY_BUCKETS)[number]

export type WaveEnvironment =
  | "production"
  | "preview"
  | "development"
  | "test"
  | "local"

export interface WaveTelemetryProperties {
  schema_version?: typeof WAVE_TELEMETRY_SCHEMA_VERSION
  environment?: WaveEnvironment
  release?: string
  is_test?: boolean
  route_template?: string
  surface?: WaveSurface
  role?: WaveTelemetryRole
  workflow?: WaveWorkflow
  action?: WaveAction
  outcome?: WaveOutcome
  generation_id?: string
  trace_id?: string
  prompt_version?: string
  model_key?: "gpt-5.6-luna"
  latency_bucket?: WaveLatencyBucket
  feature?: WaveAiFeature
  status?: WaveAiStatus
  error_code?: WaveAiErrorCode | WaveErrorCode
  input_tokens?: number
  cached_input_tokens?: number
  cache_write_tokens?: number
  output_tokens?: number
  reasoning_tokens?: number
  estimated_cost_usd?: number
  latency_ms?: number
}

export interface WaveAiGenerationCapture {
  distinctId: string
  generationId: string
  traceId: string
  role: Exclude<WaveTelemetryRole, "anonymous">
  feature: WaveAiFeature
  promptVersion: string
  status: WaveAiStatus
  latencyMs: number
  inputTokens?: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  estimatedCostUsd?: number
  errorCode?: WaveAiErrorCode
  isTest?: boolean
}

export interface WaveServerEventCapture {
  /** An analytics-only UUID derived from the authenticated user ID. */
  distinctId: string
  event: Exclude<WaveEventName, "$ai_generation">
  properties: WaveTelemetryProperties
}
