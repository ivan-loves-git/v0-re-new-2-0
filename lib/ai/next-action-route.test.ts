import { describe, expect, it, vi } from "vitest"

const effects = vi.hoisted(() => ({
  access: vi.fn(() => { throw new Error("Retired route must not authenticate") }),
  ledger: vi.fn(() => { throw new Error("Retired route must not write a run") }),
  provider: vi.fn(() => { throw new Error("Retired route must not call OpenAI") }),
}))

vi.mock("@/lib/access-control", () => ({ getCurrentUserAccessFromHeaders: effects.access }))
vi.mock("@/lib/ai/ledger", () => ({
  startWaveAiRun: effects.ledger,
  completeWaveAiRun: effects.ledger,
  failWaveAiRun: effects.ledger,
}))
vi.mock("@/lib/ai/openai-client", () => ({ getWaveAiOpenAiClient: effects.provider }))

import { POST } from "@/app/api/wave-ai/next-actions/route"

const callRoute: (request: Request) => Promise<Response> = POST

describe("retired opportunity AI advice endpoint", () => {
  it.each([
    JSON.stringify({ opportunityId: "00000000-0000-4000-8000-000000000001" }),
    "invalid json",
  ])("rejects old clients before reading data or invoking services", async (body) => {
    const request = new Request("https://app.re-new.team/api/wave-ai/next-actions", {
      method: "POST",
      body,
    })
    const readBody = vi.spyOn(request, "json")
    const response = await callRoute(request)
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({
      error: "WAVE AI next-action suggestions have been removed. Use the opportunity actions instead.",
    })
    expect(readBody).not.toHaveBeenCalled()
    expect(effects.access).not.toHaveBeenCalled()
    expect(effects.ledger).not.toHaveBeenCalled()
    expect(effects.provider).not.toHaveBeenCalled()
  })
})
