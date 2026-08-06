export interface WaveAiRunMetricRow {
  generation_id: string
  feature: "email_draft" | "next_action" | "match_review"
  status: "requested" | "succeeded" | "failed"
  error_code: string
  input_tokens: number
  cached_input_tokens: number
  cache_write_tokens: number
  output_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number | string
  latency_ms: number | null
  started_at: string
  completed_at: string | null
}

export interface WaveAiEventMetricRow {
  generation_id: string
  event_type: string
  reason_code: string
  occurred_at: string
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

export function summarizeWaveAiMetrics(
  runs: WaveAiRunMetricRow[],
  events: WaveAiEventMetricRow[],
) {
  const successes = runs.filter((run) => run.status === "succeeded")
  const failures = runs.filter((run) => run.status === "failed")
  const usefulEventTypes = new Set(["copied", "send_succeeded", "workflow_action_confirmed"])
  const usefulGenerationIds = new Set(
    events.filter((event) => usefulEventTypes.has(event.event_type)).map((event) => event.generation_id),
  )
  const latencies = successes.flatMap((run) => run.latency_ms === null ? [] : [run.latency_ms])
  const eventCounts = events.reduce<Record<string, number>>((counts, event) => {
    counts[event.event_type] = (counts[event.event_type] ?? 0) + 1
    return counts
  }, {})
  const errorCounts = failures.reduce<Record<string, number>>((counts, run) => {
    const key = run.error_code || "unknown"
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const featureCounts = runs.reduce<Record<string, { attempts: number; successes: number; useful: number }>>(
    (counts, run) => {
      const current = counts[run.feature] ?? { attempts: 0, successes: 0, useful: 0 }
      current.attempts += 1
      if (run.status === "succeeded") current.successes += 1
      if (usefulGenerationIds.has(run.generation_id)) current.useful += 1
      counts[run.feature] = current
      return counts
    },
    {},
  )
  const totalCostUsd = runs.reduce((sum, run) => sum + Number(run.estimated_cost_usd || 0), 0)

  return {
    attempts: runs.length,
    successes: successes.length,
    failures: failures.length,
    successRate: runs.length ? successes.length / runs.length : 0,
    usefulOutcomes: usefulGenerationIds.size,
    usefulOutcomeRate: successes.length ? usefulGenerationIds.size / successes.length : 0,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    costPerUsefulOutcomeUsd: usefulGenerationIds.size
      ? Number((totalCostUsd / usefulGenerationIds.size).toFixed(6))
      : 0,
    inputTokens: runs.reduce((sum, run) => sum + Number(run.input_tokens || 0), 0),
    cachedInputTokens: runs.reduce((sum, run) => sum + Number(run.cached_input_tokens || 0), 0),
    cacheWriteTokens: runs.reduce((sum, run) => sum + Number(run.cache_write_tokens || 0), 0),
    outputTokens: runs.reduce((sum, run) => sum + Number(run.output_tokens || 0), 0),
    reasoningTokens: runs.reduce((sum, run) => sum + Number(run.reasoning_tokens || 0), 0),
    medianLatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    eventCounts,
    errorCounts,
    featureCounts,
    lastSuccessfulAt: successes
      .map((run) => run.completed_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null,
  }
}

export type WaveAiMetrics = ReturnType<typeof summarizeWaveAiMetrics>

