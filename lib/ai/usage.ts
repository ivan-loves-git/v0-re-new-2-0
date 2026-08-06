import { WAVE_AI_PRICING } from "@/lib/ai/config"

export interface WaveAiTokenUsage {
  inputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  outputTokens: number
  reasoningTokens: number
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

export function normalizeWaveAiUsage(usage: {
  input_tokens?: number | null
  output_tokens?: number | null
  input_tokens_details?: {
    cached_tokens?: number | null
    cache_write_tokens?: number | null
  } | null
  output_tokens_details?: { reasoning_tokens?: number | null } | null
} | null | undefined): WaveAiTokenUsage {
  return {
    inputTokens: nonNegativeInteger(usage?.input_tokens),
    cachedInputTokens: nonNegativeInteger(usage?.input_tokens_details?.cached_tokens),
    cacheWriteTokens: nonNegativeInteger(usage?.input_tokens_details?.cache_write_tokens),
    outputTokens: nonNegativeInteger(usage?.output_tokens),
    reasoningTokens: nonNegativeInteger(usage?.output_tokens_details?.reasoning_tokens),
  }
}

export function estimateWaveAiCostUsd(usage: WaveAiTokenUsage) {
  const ordinaryInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens,
  )
  const total =
    ordinaryInputTokens * WAVE_AI_PRICING.inputUsdPerMillion +
    usage.cachedInputTokens * WAVE_AI_PRICING.cachedInputUsdPerMillion +
    usage.cacheWriteTokens * WAVE_AI_PRICING.cacheWriteUsdPerMillion +
    usage.outputTokens * WAVE_AI_PRICING.outputUsdPerMillion

  return Number((total / 1_000_000).toFixed(8))
}

