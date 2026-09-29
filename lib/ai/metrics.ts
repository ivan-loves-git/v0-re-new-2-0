/** Only these metadata fields may cross from the staff ledger reader to aggregation. */
export interface WaveAiRunMetricRow {
  generation_id: string
  feature: "email_draft" | "next_action" | "match_review" | "pdr_screening"
  status: "requested" | "succeeded" | "failed"
  environment: string
  is_test: boolean
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
  occurred_at: string
}

export type WaveAiCohortWindow = {
  fromInclusive: string
  throughInclusive: string
}

const FOLLOW_THROUGH_TYPES = new Set(["copied", "send_succeeded", "workflow_action_confirmed"])
const KNOWN_EVENT_TYPES = new Set([
  "rendered", "edit_started", "copied", "send_review_opened", "send_succeeded", "send_failed",
  "workflow_action_confirmed", "feedback_helpful", "feedback_not_helpful", "discarded",
])
const KNOWN_ERROR_CODES = new Set([
  "rate_limited", "provider_timeout", "provider_rate_limited", "provider_authentication",
  "provider_unavailable", "invalid_output", "ledger_unavailable", "invalid_request", "internal_error",
  "provider_response_failed", "invalid_output_provider_parse_failure",
  "invalid_output_provider_incomplete_max_output_tokens", "invalid_output_provider_incomplete_content_filter",
  "invalid_output_provider_incomplete_unknown", "invalid_output_provider_unparsed",
  "invalid_output_schema_mismatch", "invalid_output_unsafe_clarification_question",
  "invalid_output_goal_milestone_pair", "invalid_output_stale_policy", "invalid_output_unknown_goal",
  "invalid_output_unknown_milestone", "invalid_output_goal_milestone_mismatch",
  "invalid_output_invalid_overlap",
])

function inWindow(value: string, window: WaveAiCohortWindow) {
  const date = Date.parse(value)
  return Number.isFinite(date) && date >= Date.parse(window.fromInclusive)
    && date <= Date.parse(window.throughInclusive)
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

/** Rechecks DB filters in pure code, so stale or stray events never inflate this cohort. */
export function summarizeWaveAiMetrics(
  candidateRuns: WaveAiRunMetricRow[],
  candidateEvents: WaveAiEventMetricRow[],
  window: WaveAiCohortWindow,
) {
  const runs = candidateRuns.filter((run) => run.environment === "production"
    && run.is_test === false && inWindow(run.started_at, window))
  const runById = new Map(runs.map((run) => [run.generation_id, run]))
  const events = candidateEvents.filter((event) => runById.has(event.generation_id)
    && inWindow(event.occurred_at, window))
  const successes = runs.filter((run) => run.status === "succeeded")
  const failures = runs.filter((run) => run.status === "failed")
  const pending = runs.filter((run) => run.status === "requested")
  const completed = successes.length + failures.length
  const followThroughIds = new Set(events.filter((event) => FOLLOW_THROUGH_TYPES.has(event.event_type)
    && runById.get(event.generation_id)?.status === "succeeded").map((event) => event.generation_id))
  const latencies = successes.flatMap((run) => run.latency_ms === null ? [] : [run.latency_ms])
  const eventCounts = events.reduce<Record<string, number>>((counts, event) => {
    const key = KNOWN_EVENT_TYPES.has(event.event_type) ? event.event_type : "other_recorded_event"
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const errorCounts = failures.reduce<Record<string, number>>((counts, run) => {
    const key = KNOWN_ERROR_CODES.has(run.error_code) ? run.error_code : "other_recorded_error"
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const featureCounts = runs.reduce<Record<string, { attempts: number; successes: number; followThrough: number }>>(
    (counts, run) => {
      const current = counts[run.feature] ?? { attempts: 0, successes: 0, followThrough: 0 }
      current.attempts += 1
      if (run.status === "succeeded") current.successes += 1
      if (followThroughIds.has(run.generation_id)) current.followThrough += 1
      counts[run.feature] = current
      return counts
    },
    {},
  )
  const totalCostUsd = runs.reduce((sum, run) => sum + Number(run.estimated_cost_usd || 0), 0)
  const lastRunAt = runs.flatMap((run) => [run.started_at, ...(run.completed_at ? [run.completed_at] : [])])
    .filter((value) => inWindow(value, window)).sort().at(-1) ?? null
  const lastEventAt = events.map((event) => event.occurred_at).sort().at(-1) ?? null

  return {
    attempts: runs.length,
    successes: successes.length,
    failures: failures.length,
    pending: pending.length,
    successRate: completed ? successes.length / completed : null,
    recordedFollowThrough: followThroughIds.size,
    followThroughRate: successes.length ? followThroughIds.size / successes.length : null,
    recordedHelpfulFeedback: eventCounts.feedback_helpful ?? 0,
    recordedUnhelpfulFeedback: eventCounts.feedback_not_helpful ?? 0,
    totalCostUsd: Number(totalCostUsd.toFixed(8)),
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
    linkedEventCount: events.length,
    lastSuccessfulAt: successes.map((run) => run.completed_at)
      .filter((value): value is string => typeof value === "string" && inWindow(value, window)).sort().at(-1) ?? null,
    lastLedgerActivityAt: [lastRunAt, lastEventAt].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
  }
}

export type WaveAiMetrics = ReturnType<typeof summarizeWaveAiMetrics>
