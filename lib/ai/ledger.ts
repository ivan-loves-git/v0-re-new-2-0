import "server-only"

import { requireStaffAccess } from "@/lib/access-control"
import {
  WAVE_AI_MODEL,
  WAVE_AI_OUTPUT_SCHEMA_VERSION,
  WAVE_AI_PRICING,
  WAVE_AI_PROMPT_VERSION,
  WAVE_AI_PROVIDER,
  WAVE_AI_RATE_LIMIT,
  WAVE_AI_REASONING_EFFORT,
} from "@/lib/ai/config"
import { WaveAiLedgerError, WaveAiRateLimitError, type WaveAiErrorCode } from "@/lib/ai/errors"
import type { PdrScreeningLedgerErrorCode } from "@/lib/ai/pdr-screening-output-error"
import {
  summarizeWaveAiMetrics,
  type WaveAiEventMetricRow,
  type WaveAiRunMetricRow,
} from "@/lib/ai/metrics"
import type { WaveAiTokenUsage } from "@/lib/ai/usage"
import { createAdminClient } from "@/lib/supabase/admin"

export type WaveAiFeature = "email_draft" | "next_action" | "match_review" | "pdr_screening"

function runtimeEnvironment() {
  if (process.env.NODE_ENV === "test") return "test" as const
  if (process.env.VERCEL_ENV === "preview") return "preview" as const
  if (process.env.NODE_ENV === "production") return "production" as const
  return "development" as const
}

function runtimeRelease() {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_VERSION ?? "")
    .trim()
    .slice(0, 80)
}

export interface StartedWaveAiRun {
  generationId: string
  traceId: string
  startedAt: string
}

export async function startWaveAiRun(input: {
  actorUserId: string
  feature: WaveAiFeature
  workflow: string
  surface: string
  promptVersion?: string
  outputSchemaVersion?: string
}): Promise<StartedWaveAiRun> {
  const supabase = createAdminClient()
  const rateLimitStart = new Date(Date.now() - WAVE_AI_RATE_LIMIT.windowMs).toISOString()
  const payload = {
      initiated_by_user_id: input.actorUserId,
      app_role: "staff",
      feature: input.feature,
      workflow: input.workflow,
      surface: input.surface,
      prompt_version: input.promptVersion ?? WAVE_AI_PROMPT_VERSION,
      output_schema_version: input.outputSchemaVersion ?? WAVE_AI_OUTPUT_SCHEMA_VERSION,
      provider: WAVE_AI_PROVIDER,
      model: WAVE_AI_MODEL,
      reasoning_effort: WAVE_AI_REASONING_EFFORT,
      pricing_version: WAVE_AI_PRICING.version,
      environment: runtimeEnvironment(),
      release: runtimeRelease(),
      is_test: process.env.NODE_ENV === "test",
    }
  const { data, error } = await (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: { generation_id: string; trace_id: string; started_at: string }[] | null; error: { message?: string } | null }> }).rpc("admit_wave_ai_run", {
    payload, window_started_at: rateLimitStart, request_limit: WAVE_AI_RATE_LIMIT.requests,
  })

  if (error?.message?.includes("wave_ai_rate_limited")) throw new WaveAiRateLimitError()
  if (error || !data?.[0]) throw new WaveAiLedgerError()
  return {
    generationId: data[0].generation_id,
    traceId: data[0].trace_id,
    startedAt: data[0].started_at,
  }
}

export async function completeWaveAiRun(input: {
  generationId: string
  usage: WaveAiTokenUsage
  estimatedCostUsd: number
  latencyMs: number
}) {
  const completedAt = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from("ai_generation_runs")
    .update({
      status: "succeeded",
      input_tokens: input.usage.inputTokens,
      cached_input_tokens: input.usage.cachedInputTokens,
      cache_write_tokens: input.usage.cacheWriteTokens,
      output_tokens: input.usage.outputTokens,
      reasoning_tokens: input.usage.reasoningTokens,
      estimated_cost_usd: input.estimatedCostUsd,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("generation_id", input.generationId)
    .eq("status", "requested")
    .select("generation_id")
    .maybeSingle()

  if (error || !data) throw new WaveAiLedgerError()
}

export async function failWaveAiRun(input: {
  generationId: string
  code: WaveAiErrorCode | PdrScreeningLedgerErrorCode
  latencyMs: number
}) {
  const completedAt = new Date().toISOString()
  await createAdminClient()
    .from("ai_generation_runs")
    .update({
      status: "failed",
      error_code: input.code,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("generation_id", input.generationId)
    .eq("status", "requested")
}

export async function recordWaveAiGenerationEvent(input: {
  actorUserId: string
  generationId: string
  eventType: string
  reasonCode?: string
  actionKey?: string
}) {
  const supabase = createAdminClient()
  const { data: run, error: runError } = await supabase
    .from("ai_generation_runs")
    .select("generation_id")
    .eq("generation_id", input.generationId)
    .eq("initiated_by_user_id", input.actorUserId)
    .eq("status", "succeeded")
    .maybeSingle()

  if (runError || !run) throw new WaveAiLedgerError()

  const { error } = await supabase
    .from("ai_generation_events")
    .upsert({
      generation_id: input.generationId,
      actor_user_id: input.actorUserId,
      event_type: input.eventType,
      reason_code: input.reasonCode ?? "",
      action_key: input.actionKey ?? "",
    }, {
      onConflict: "generation_id,event_type",
      ignoreDuplicates: true,
    })

  if (error) throw new WaveAiLedgerError()
}

export async function getWaveAiDashboardMetrics(days: 7 | 30) {
  await requireStaffAccess()
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data: runs, error: runsError } = await supabase
    .from("ai_generation_runs")
    .select("generation_id, feature, status, error_code, input_tokens, cached_input_tokens, cache_write_tokens, output_tokens, reasoning_tokens, estimated_cost_usd, latency_ms, started_at, completed_at")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(5000)

  if (runsError) throw new WaveAiLedgerError()

  const { data: events, error: eventsError } = await supabase
    .from("ai_generation_events")
    .select("generation_id, event_type, reason_code, occurred_at")
    .gte("occurred_at", cutoff)
    .order("occurred_at", { ascending: false })
    .limit(10000)

  if (eventsError) throw new WaveAiLedgerError()
  return summarizeWaveAiMetrics(
    (runs ?? []) as WaveAiRunMetricRow[],
    (events ?? []) as WaveAiEventMetricRow[],
  )
}
