import { describe, expect, it } from "vitest"
import { summarizeWaveAiMetrics, type WaveAiRunMetricRow } from "@/lib/ai/metrics"

function run(overrides: Partial<WaveAiRunMetricRow>): WaveAiRunMetricRow {
  return {
    generation_id: "generation-1",
    feature: "email_draft",
    status: "succeeded",
    error_code: "",
    input_tokens: 100,
    cached_input_tokens: 10,
    cache_write_tokens: 5,
    output_tokens: 20,
    reasoning_tokens: 8,
    estimated_cost_usd: 0.001,
    latency_ms: 1_000,
    started_at: "2026-08-06T08:00:00.000Z",
    completed_at: "2026-08-06T08:00:01.000Z",
    ...overrides,
  }
}

describe("WAVE AI usage metrics", () => {
  it("counts a generation once even when it has multiple useful outcome events", () => {
    const metrics = summarizeWaveAiMetrics(
      [run({}), run({ generation_id: "generation-2", status: "failed", error_code: "provider_timeout", latency_ms: 500 })],
      [
        { generation_id: "generation-1", event_type: "copied", reason_code: "", occurred_at: "2026-08-06T08:01:00.000Z" },
        { generation_id: "generation-1", event_type: "send_succeeded", reason_code: "", occurred_at: "2026-08-06T08:02:00.000Z" },
        { generation_id: "generation-1", event_type: "feedback_helpful", reason_code: "", occurred_at: "2026-08-06T08:03:00.000Z" },
      ],
    )

    expect(metrics).toMatchObject({
      attempts: 2,
      successes: 1,
      failures: 1,
      successRate: 0.5,
      usefulOutcomes: 1,
      usefulOutcomeRate: 1,
      totalCostUsd: 0.002,
      costPerUsefulOutcomeUsd: 0.002,
      medianLatencyMs: 1_000,
      p95LatencyMs: 1_000,
      lastSuccessfulAt: "2026-08-06T08:00:01.000Z",
    })
    expect(metrics.eventCounts).toEqual({ copied: 1, send_succeeded: 1, feedback_helpful: 1 })
    expect(metrics.errorCounts).toEqual({ provider_timeout: 1 })
    expect(metrics.featureCounts.email_draft).toEqual({ attempts: 2, successes: 1, useful: 1 })
  })

  it("returns stable zero values for an empty window", () => {
    expect(summarizeWaveAiMetrics([], [])).toMatchObject({
      attempts: 0,
      successes: 0,
      usefulOutcomes: 0,
      usefulOutcomeRate: 0,
      totalCostUsd: 0,
      medianLatencyMs: 0,
      lastSuccessfulAt: null,
    })
  })
})
