import { describe, expect, it } from "vitest"
import {
  summarizeWaveAiMetrics, type WaveAiCohortWindow, type WaveAiRunMetricRow,
} from "@/lib/ai/metrics"

const window: WaveAiCohortWindow = {
  fromInclusive: "2026-09-23T12:00:00.000Z",
  throughInclusive: "2026-09-30T12:00:00.000Z",
}

function run(overrides: Partial<WaveAiRunMetricRow> = {}): WaveAiRunMetricRow {
  return {
    generation_id: "generation-1", feature: "email_draft", status: "succeeded",
    environment: "production", is_test: false, error_code: "",
    input_tokens: 100, cached_input_tokens: 10, cache_write_tokens: 5,
    output_tokens: 20, reasoning_tokens: 8, estimated_cost_usd: 0.001,
    latency_ms: 1_000, started_at: "2026-09-25T08:00:00.000Z",
    completed_at: "2026-09-25T08:00:01.000Z", ...overrides,
  }
}

describe("WAVE AI bounded ledger metrics", () => {
  it("uses only production non-test runs and their linked same-window events", () => {
    const metrics = summarizeWaveAiMetrics([
      run(),
      run({ generation_id: "generation-2", feature: "pdr_screening",
        status: "failed", error_code: "provider_timeout", latency_ms: 500 }),
      run({ generation_id: "generation-test", is_test: true, estimated_cost_usd: 9 }),
      run({ generation_id: "generation-preview", environment: "preview", estimated_cost_usd: 9 }),
      run({ generation_id: "generation-old", started_at: "2026-09-22T08:00:00Z", estimated_cost_usd: 9 }),
      run({ generation_id: "generation-new", started_at: "2026-09-30T12:00:01Z", estimated_cost_usd: 9 }),
    ], [
      { generation_id: "generation-1", event_type: "copied", occurred_at: "2026-09-25T08:01:00Z" },
      { generation_id: "generation-1", event_type: "send_succeeded", occurred_at: "2026-09-25T08:02:00Z" },
      { generation_id: "generation-1", event_type: "feedback_helpful", occurred_at: "2026-09-25T08:03:00Z" },
      { generation_id: "generation-2", event_type: "copied", occurred_at: "2026-09-25T08:04:00Z" },
      { generation_id: "generation-test", event_type: "feedback_helpful", occurred_at: "2026-09-25T08:05:00Z" },
      { generation_id: "unlinked", event_type: "copied", occurred_at: "2026-09-25T08:06:00Z" },
      { generation_id: "generation-1", event_type: "copied", occurred_at: "2026-09-30T12:00:01Z" },
    ], window)

    expect(metrics).toMatchObject({
      attempts: 2, successes: 1, failures: 1, pending: 0, successRate: 0.5,
      recordedFollowThrough: 1, followThroughRate: 1,
      recordedHelpfulFeedback: 1, totalCostUsd: 0.002,
      linkedEventCount: 4, medianLatencyMs: 1_000, p95LatencyMs: 1_000,
      lastSuccessfulAt: "2026-09-25T08:00:01.000Z",
      lastLedgerActivityAt: "2026-09-25T08:04:00Z",
    })
    expect(metrics.eventCounts).toEqual({ copied: 2, send_succeeded: 1, feedback_helpful: 1 })
    expect(metrics.errorCounts).toEqual({ provider_timeout: 1 })
    expect(metrics.featureCounts.pdr_screening).toEqual({ attempts: 1, successes: 0, followThrough: 0 })
  })

  it("returns N/A denominators and latency for an empty or pending-only window", () => {
    const empty = summarizeWaveAiMetrics([], [], window)
    expect(empty).toMatchObject({
      attempts: 0, successes: 0, pending: 0, successRate: null,
      followThroughRate: null, medianLatencyMs: null, p95LatencyMs: null,
      totalCostUsd: 0, lastLedgerActivityAt: null,
    })
    const pending = summarizeWaveAiMetrics([
      run({ status: "requested", completed_at: null, latency_ms: null }),
    ], [], window)
    expect(pending).toMatchObject({ attempts: 1, pending: 1, successRate: null,
      recordedFollowThrough: 0, followThroughRate: null })
  })

  it("buckets unknown metadata codes without serializing their raw values", () => {
    const metrics = summarizeWaveAiMetrics([
      run({ status: "failed", error_code: "sensitive unexpected value", completed_at: "2026-09-25T08:01:00Z" }),
    ], [{ generation_id: "generation-1", event_type: "untrusted detail", occurred_at: "2026-09-25T08:02:00Z" }], window)
    expect(metrics.errorCounts).toEqual({ other_recorded_error: 1 })
    expect(metrics.eventCounts).toEqual({ other_recorded_event: 1 })
    expect(JSON.stringify(metrics)).not.toMatch(/sensitive unexpected value|untrusted detail|generation-1/)
  })
})
