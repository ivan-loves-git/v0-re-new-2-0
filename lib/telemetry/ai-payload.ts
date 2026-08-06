import {
  WAVE_TELEMETRY_SCHEMA_VERSION,
  type WaveAiGenerationCapture,
  type WaveEnvironment,
} from "@/lib/telemetry/contract"
import {
  isOpaqueUuid,
  sanitizeRelease,
  sanitizeVersion,
} from "@/lib/telemetry/privacy"

export interface ServerTelemetryContext {
  environment: WaveEnvironment
  release: string
  isTest: boolean
}

function boundedCount(value: number | undefined) {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) return undefined
  return Math.trunc(value)
}

function boundedCost(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 10_000
    ? value
    : undefined
}

export function latencyBucket(latencyMs: number) {
  if (latencyMs < 1_000) return "under_1s" as const
  if (latencyMs < 3_000) return "1s_to_3s" as const
  if (latencyMs < 10_000) return "3s_to_10s" as const
  if (latencyMs < 30_000) return "10s_to_30s" as const
  return "over_30s" as const
}

export function buildAiGenerationPayload(
  capture: WaveAiGenerationCapture,
  context: ServerTelemetryContext,
) {
  const promptVersion = sanitizeVersion(capture.promptVersion)
  if (
    !isOpaqueUuid(capture.distinctId) ||
    !isOpaqueUuid(capture.generationId) ||
    !isOpaqueUuid(capture.traceId) ||
    !promptVersion ||
    !Number.isFinite(capture.latencyMs) ||
    capture.latencyMs < 0 ||
    capture.latencyMs > 3_600_000
  ) {
    return null
  }

  const properties: Record<string, string | number | boolean> = {
    distinct_id: capture.distinctId,
    $ai_trace_id: capture.traceId,
    $ai_span_id: capture.generationId,
    $ai_model: "gpt-5.6-luna",
    $ai_provider: "openai",
    $ai_latency: capture.latencyMs / 1_000,
    $ai_is_error: capture.status === "failed",
    schema_version: WAVE_TELEMETRY_SCHEMA_VERSION,
    environment: context.environment,
    release: sanitizeRelease(context.release),
    is_test: capture.isTest ?? context.isTest,
    role: capture.role,
    feature: capture.feature,
    status: capture.status,
    generation_id: capture.generationId,
    trace_id: capture.traceId,
    prompt_version: promptVersion,
    model_key: "gpt-5.6-luna",
    latency_ms: Math.trunc(capture.latencyMs),
    latency_bucket: latencyBucket(capture.latencyMs),
  }

  const inputTokens = boundedCount(capture.inputTokens)
  const cachedInputTokens = boundedCount(capture.cachedInputTokens)
  const cacheWriteTokens = boundedCount(capture.cacheWriteTokens)
  const outputTokens = boundedCount(capture.outputTokens)
  const reasoningTokens = boundedCount(capture.reasoningTokens)
  const estimatedCost = boundedCost(capture.estimatedCostUsd)

  if (inputTokens !== undefined) {
    properties.$ai_input_tokens = inputTokens
    properties.input_tokens = inputTokens
  }
  if (cachedInputTokens !== undefined) properties.cached_input_tokens = cachedInputTokens
  if (cacheWriteTokens !== undefined) properties.cache_write_tokens = cacheWriteTokens
  if (outputTokens !== undefined) {
    properties.$ai_output_tokens = outputTokens
    properties.output_tokens = outputTokens
  }
  if (reasoningTokens !== undefined) properties.reasoning_tokens = reasoningTokens
  if (estimatedCost !== undefined) {
    properties.$ai_total_cost_usd = estimatedCost
    properties.estimated_cost_usd = estimatedCost
  }
  if (capture.status === "failed" && capture.errorCode) {
    properties.$ai_error = capture.errorCode
    properties.error_code = capture.errorCode
  }

  return { event: "$ai_generation" as const, properties }
}
