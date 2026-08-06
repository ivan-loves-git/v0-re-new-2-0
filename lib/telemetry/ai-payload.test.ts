import { describe, expect, it } from "vitest"
import { buildAiGenerationPayload, latencyBucket } from "@/lib/telemetry/ai-payload"

const capture = {
  distinctId: "019fd674-9442-7000-a255-fa06c75772d7",
  generationId: "019fd674-9442-7000-a255-fa06c75772d8",
  traceId: "019fd674-9442-7000-a255-fa06c75772d9",
  role: "staff" as const,
  feature: "email_draft" as const,
  promptVersion: "email-draft-v1",
  status: "succeeded" as const,
  latencyMs: 2_450,
  inputTokens: 120,
  cachedInputTokens: 20,
  outputTokens: 60,
  reasoningTokens: 15,
  estimatedCostUsd: 0.042,
}

describe("metadata-only AI telemetry payload", () => {
  it("contains usage metadata without prompts, outputs, or business identifiers", () => {
    const result = buildAiGenerationPayload(capture, {
      environment: "production",
      release: "1200.abc1234",
      isTest: false,
    })

    expect(result).toMatchObject({
      event: "$ai_generation",
      properties: {
        distinct_id: capture.distinctId,
        $ai_trace_id: capture.traceId,
        $ai_span_id: capture.generationId,
        $ai_model: "gpt-5.6-luna",
        $ai_provider: "openai",
        $ai_input_tokens: 120,
        $ai_output_tokens: 60,
        $ai_total_cost_usd: 0.042,
        latency_bucket: "1s_to_3s",
      },
    })
    expect(result?.properties).not.toHaveProperty("$ai_input")
    expect(result?.properties).not.toHaveProperty("$ai_output_choices")
    expect(result?.properties).not.toHaveProperty("prompt")
    expect(result?.properties).not.toHaveProperty("generated_content")
    expect(result?.properties).not.toHaveProperty("email")
    expect(result?.properties).not.toHaveProperty("repreneur_id")
    expect(result?.properties).not.toHaveProperty("opportunity_id")
  })

  it("rejects non-UUID identities before a payload can reach transport", () => {
    expect(
      buildAiGenerationPayload(
        { ...capture, distinctId: "person@example.com" },
        { environment: "production", release: "1200.abc1234", isTest: false },
      ),
    ).toBeNull()
  })

  it("uses bounded latency buckets", () => {
    expect(latencyBucket(999)).toBe("under_1s")
    expect(latencyBucket(1_000)).toBe("1s_to_3s")
    expect(latencyBucket(30_000)).toBe("over_30s")
  })
})

