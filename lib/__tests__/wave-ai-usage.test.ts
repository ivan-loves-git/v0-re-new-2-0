import { describe, expect, it } from "vitest"
import { estimateWaveAiCostUsd, normalizeWaveAiUsage } from "@/lib/ai/usage"

describe("WAVE AI token usage and cost", () => {
  it("normalizes the provider response without accepting invalid token counts", () => {
    expect(normalizeWaveAiUsage({
      input_tokens: 1_000,
      output_tokens: 250,
      input_tokens_details: { cached_tokens: 300, cache_write_tokens: 200 },
      output_tokens_details: { reasoning_tokens: 100 },
    })).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 300,
      cacheWriteTokens: 200,
      outputTokens: 250,
      reasoningTokens: 100,
    })

    expect(normalizeWaveAiUsage({ input_tokens: -2, output_tokens: Number.NaN })).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
    })
  })

  it("uses the versioned Luna prices and does not double-charge cache tokens", () => {
    expect(estimateWaveAiCostUsd({
      inputTokens: 1_000_000,
      cachedInputTokens: 300_000,
      cacheWriteTokens: 200_000,
      outputTokens: 250_000,
      reasoningTokens: 100_000,
    })).toBe(2.28)
  })
})
