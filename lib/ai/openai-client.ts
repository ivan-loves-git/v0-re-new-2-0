import "server-only"

import OpenAI from "openai"
import { WaveAiConfigurationError } from "@/lib/ai/errors"
import { env } from "@/lib/env"

let client: OpenAI | null = null

export function getWaveAiOpenAiClient() {
  if (!env.OPENAI_API_KEY) throw new WaveAiConfigurationError()
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 45_000,
    })
  }
  return client
}
