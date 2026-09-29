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
  type WaveAiCohortWindow,
  type WaveAiEventMetricRow,
  type WaveAiMetrics,
  type WaveAiRunMetricRow,
} from "@/lib/ai/metrics"
import { readCompleteLedgerPages, type LedgerIncompleteReason } from "@/lib/ai/ledger-pagination"
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
  reasoningEffort?: typeof WAVE_AI_REASONING_EFFORT | "low"
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
      reasoning_effort: input.reasoningEffort ?? WAVE_AI_REASONING_EFFORT,
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

const LEDGER_PAGE_SIZE = 500
const LEDGER_RUN_CAP = 10_000
const LEDGER_EVENT_CAP = 20_000
const LEDGER_EVENT_BATCH = 100

export type WaveAiLedgerSnapshot = {
  days: 7 | 30
  asOf: string
  windowStart: string
} & (
  | { state: "complete"; metrics: WaveAiMetrics }
  | { state: "incomplete"; reason: LedgerIncompleteReason | "invalid_row" }
)

function within(value: string, window: WaveAiCohortWindow) {
  const time = Date.parse(value)
  return Number.isFinite(time) && time >= Date.parse(window.fromInclusive)
    && time <= Date.parse(window.throughInclusive)
}

function validRun(row: WaveAiRunMetricRow, window: WaveAiCohortWindow) {
  return typeof row.generation_id === "string" && row.generation_id.length > 0
    && row.environment === "production" && row.is_test === false
    && ["email_draft", "next_action", "match_review", "pdr_screening"].includes(row.feature)
    && ["requested", "succeeded", "failed"].includes(row.status)
    && typeof row.error_code === "string" && within(row.started_at, window)
    && (row.status === "requested" ? row.completed_at === null
      : typeof row.completed_at === "string" && within(row.completed_at, window))
    && (row.latency_ms === null || Number.isFinite(row.latency_ms) && row.latency_ms >= 0)
    && [row.input_tokens, row.cached_input_tokens, row.cache_write_tokens,
      row.output_tokens, row.reasoning_tokens].every((value) => Number.isSafeInteger(value) && value >= 0)
    && Number.isFinite(Number(row.estimated_cost_usd)) && Number(row.estimated_cost_usd) >= 0
}

function validEvent(row: WaveAiEventMetricRow, window: WaveAiCohortWindow, runIds: Set<string>) {
  return typeof row.generation_id === "string" && runIds.has(row.generation_id)
    && typeof row.event_type === "string" && within(row.occurred_at, window)
}

/** Exact-count bounded cohort; no raw rows or identifiers leave this server function. */
export async function getWaveAiDashboardSnapshot(days: 7 | 30): Promise<WaveAiLedgerSnapshot> {
  await requireStaffAccess()
  const asOf = new Date().toISOString()
  const windowStart = new Date(Date.parse(asOf) - days * 24 * 60 * 60 * 1000).toISOString()
  const window = { fromInclusive: windowStart, throughInclusive: asOf }
  const base = { days, asOf, windowStart }
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return { ...base, state: "incomplete", reason: "read_failed" }
  }
  const runs = await readCompleteLedgerPages<WaveAiRunMetricRow>({
    cap: LEDGER_RUN_CAP, pageSize: LEDGER_PAGE_SIZE, key: (row) => row.generation_id,
    fetchPage: async (from, through) => {
      const result = await supabase.from("ai_generation_runs")
        .select("generation_id,feature,status,environment,is_test,error_code,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,reasoning_tokens,estimated_cost_usd,latency_ms,started_at,completed_at", { count: "exact" })
        .eq("environment", "production").eq("is_test", false)
        .gte("started_at", windowStart).lte("started_at", asOf)
        .order("started_at", { ascending: true }).order("generation_id", { ascending: true })
        .range(from, through)
      return { data: result.data as WaveAiRunMetricRow[] | null, count: result.count, error: result.error }
    },
  })
  if (runs.state === "incomplete") return { ...base, state: "incomplete", reason: runs.reason }
  if (!runs.rows.every((row) => validRun(row, window))) {
    return { ...base, state: "incomplete", reason: "invalid_row" }
  }

  const events: WaveAiEventMetricRow[] = []
  const runIds = new Set(runs.rows.map((row) => row.generation_id))
  const ids = [...runIds]
  for (let offset = 0; offset < ids.length; offset += LEDGER_EVENT_BATCH) {
    const batch = ids.slice(offset, offset + LEDGER_EVENT_BATCH)
    const pageSet = await readCompleteLedgerPages<WaveAiEventMetricRow>({
      cap: LEDGER_EVENT_CAP - events.length, pageSize: LEDGER_PAGE_SIZE,
      key: (row) => `${row.generation_id}:${row.event_type}`,
      fetchPage: async (from, through) => {
        const result = await supabase.from("ai_generation_events")
          .select("generation_id,event_type,occurred_at", { count: "exact" })
          .in("generation_id", batch)
          .gte("occurred_at", windowStart).lte("occurred_at", asOf)
          .order("occurred_at", { ascending: true }).order("generation_id", { ascending: true })
          .order("event_type", { ascending: true }).range(from, through)
        return { data: result.data as WaveAiEventMetricRow[] | null, count: result.count, error: result.error }
      },
    })
    if (pageSet.state === "incomplete") return { ...base, state: "incomplete", reason: pageSet.reason }
    if (!pageSet.rows.every((row) => validEvent(row, window, runIds))) {
      return { ...base, state: "incomplete", reason: "invalid_row" }
    }
    events.push(...pageSet.rows)
  }
  return { ...base, state: "complete", metrics: summarizeWaveAiMetrics(runs.rows, events, window) }
}
