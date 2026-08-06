export const WAVE_AI_PROVIDER = "openai" as const
export const WAVE_AI_MODEL = "gpt-5.6-luna" as const
export const WAVE_AI_REASONING_EFFORT = "max" as const
export const WAVE_AI_PROMPT_VERSION = "email-draft-v1" as const
export const WAVE_AI_OUTPUT_SCHEMA_VERSION = "email-draft-v1" as const

export const WAVE_AI_PRICING = {
  version: "2026-08-06",
  inputUsdPerMillion: 1,
  cachedInputUsdPerMillion: 0.1,
  cacheWriteUsdPerMillion: 1.25,
  outputUsdPerMillion: 6,
} as const

export const WAVE_AI_RATE_LIMIT = {
  requests: 5,
  windowMs: 60_000,
} as const

