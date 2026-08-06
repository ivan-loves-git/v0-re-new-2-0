import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { waveAiEmailDraftRequestSchema, waveAiGenerationEventSchema } from "@/lib/ai/email-contract"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("WAVE AI runtime contract", () => {
  it("uses one Luna Max Responses API configuration with provider storage disabled", () => {
    const config = source("lib/ai/config.ts")
    const generation = source("lib/ai/email-drafting.ts")
    const packageJson = source("package.json")

    expect(config).toContain('WAVE_AI_MODEL = "gpt-5.6-luna"')
    expect(config).toContain('WAVE_AI_REASONING_EFFORT = "max"')
    expect(generation).toContain("client.responses.parse")
    expect(generation).toContain("store: false")
    expect(generation).toContain("context: \"current_turn\"")
    expect(generation).not.toMatch(/tools\s*:/)
    expect(packageJson).toContain('"openai": "7.4.0"')
    expect(packageJson).not.toContain("@anthropic-ai/sdk")
  })

  it("authorizes staff before ledger, CRM or provider access", () => {
    for (const path of [
      "app/api/wave-ai/generate/route.ts",
      "app/api/wave-ai/events/route.ts",
      "app/api/wave-ai/repreneurs/route.ts",
    ]) {
      const file = source(path)
      const route = file.slice(file.indexOf("export async function"))
      const authorization = route.indexOf("getCurrentUserAccess")
      const role = route.indexOf('access.role !== "staff"')
      const firstProtectedOperation = Math.min(...[
        route.indexOf("startWaveAiRun"),
        route.indexOf("recordWaveAiGenerationEvent"),
        route.indexOf("createAdminClient"),
      ].filter((index) => index >= 0))
      expect(authorization).toBeGreaterThan(-1)
      expect(role).toBeGreaterThan(authorization)
      expect(role).toBeLessThan(firstProtectedOperation)
    }
  })

  it("keeps the AI ledger metadata-only and unavailable to browser roles", () => {
    const migration = source("scripts/085_wave_ai_generation_ledger.sql")
    const ledger = source("lib/ai/ledger.ts")
    for (const forbidden of ["prompt_text", "output_text", "email_address", "repreneur_id", "provider_response"]) {
      expect(migration).not.toContain(forbidden)
      expect(ledger).not.toContain(forbidden)
    }
    expect(migration).toContain("FORCE ROW LEVEL SECURITY")
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role")
    expect(migration).not.toMatch(/CREATE POLICY/i)
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_generation_runs TO service_role")
    expect(migration).toContain("GRANT SELECT, INSERT ON TABLE public.ai_generation_events TO service_role")
  })

  it("bounds requests and enforces allowlisted feedback without free text", () => {
    const validRequest = waveAiEmailDraftRequestSchema.safeParse({
      repreneurId: "8d00a3f2-2d4a-45fe-ae39-5cba0d2134fd",
      templateId: "follow-up",
      language: "fr",
      customInstructions: "Reconnect politely.",
    })
    expect(validRequest.success).toBe(true)
    expect(waveAiEmailDraftRequestSchema.safeParse({
      repreneurId: "not-an-id",
      templateId: "follow-up",
      language: "fr",
      customInstructions: "x".repeat(1_201),
    }).success).toBe(false)
    expect(waveAiGenerationEventSchema.safeParse({
      generationId: "8d00a3f2-2d4a-45fe-ae39-5cba0d2134fd",
      eventType: "feedback_not_helpful",
    }).success).toBe(false)
    expect(waveAiGenerationEventSchema.safeParse({
      generationId: "8d00a3f2-2d4a-45fe-ae39-5cba0d2134fd",
      eventType: "feedback_not_helpful",
      reasonCode: "wrong_fact",
      freeText: "the entire customer email",
    }).success).toBe(false)
  })

  it("retires the direct AI send path", () => {
    const retiredSend = source("app/api/wavy/send/route.ts")
    const tool = source("components/wave-ai/wave-ai-tool.tsx")
    expect(retiredSend).toContain("status: 410")
    expect(retiredSend).not.toContain("resend")
    expect(tool).toContain("navigator.clipboard.writeText")
    expect(tool).not.toContain("/api/wavy/send")
    expect(tool).not.toContain("sendEmail")
  })
})
