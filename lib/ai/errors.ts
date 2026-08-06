import OpenAI from "openai"

export type WaveAiErrorCode =
  | "rate_limited"
  | "provider_timeout"
  | "provider_rate_limited"
  | "provider_authentication"
  | "provider_unavailable"
  | "invalid_output"
  | "ledger_unavailable"
  | "invalid_request"
  | "internal_error"

export class WaveAiRateLimitError extends Error {
  constructor() {
    super("WAVE AI request limit reached.")
    this.name = "WaveAiRateLimitError"
  }
}

export class WaveAiLedgerError extends Error {
  constructor() {
    super("WAVE AI usage logging is unavailable.")
    this.name = "WaveAiLedgerError"
  }
}

export class WaveAiInvalidRequestError extends Error {
  constructor() {
    super("Invalid WAVE AI request.")
    this.name = "WaveAiInvalidRequestError"
  }
}

export class WaveAiConfigurationError extends Error {
  constructor() {
    super("WAVE AI is not configured.")
    this.name = "WaveAiConfigurationError"
  }
}

export function classifyWaveAiError(error: unknown): WaveAiErrorCode {
  if (error instanceof WaveAiRateLimitError) return "rate_limited"
  if (error instanceof WaveAiLedgerError) return "ledger_unavailable"
  if (error instanceof WaveAiInvalidRequestError) return "invalid_request"
  if (error instanceof WaveAiConfigurationError) return "provider_authentication"
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "provider_timeout"
  if (error instanceof OpenAI.AuthenticationError) return "provider_authentication"
  if (error instanceof OpenAI.RateLimitError) return "provider_rate_limited"
  if (error instanceof OpenAI.APIConnectionError) return "provider_unavailable"
  if (error instanceof SyntaxError) return "invalid_output"
  return "internal_error"
}

export function publicWaveAiError(code: WaveAiErrorCode) {
  if (code === "rate_limited") return { status: 429, message: "Too many WAVE AI requests. Try again in a minute." }
  if (code === "invalid_request") return { status: 400, message: "Check the selected recipient, template and instructions." }
  if (code === "ledger_unavailable") return { status: 503, message: "WAVE AI usage logging is unavailable. No model request was made." }
  if (code === "provider_rate_limited") return { status: 503, message: "WAVE AI is temporarily busy. Try again shortly." }
  if (code === "provider_timeout" || code === "provider_unavailable") {
    return { status: 503, message: "WAVE AI did not respond in time. Try again." }
  }
  if (code === "provider_authentication") return { status: 503, message: "WAVE AI is not configured correctly." }
  return { status: 500, message: "WAVE AI could not create this draft." }
}
