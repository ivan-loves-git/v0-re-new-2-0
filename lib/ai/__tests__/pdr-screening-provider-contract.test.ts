import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ stale: false, calls: [] as any[] }))
const draft = { classification: "needs_clarification", affectedUsers: "Staff members", desiredOutcome: "A clear request", successSignal: "Staff can understand it.", clarificationQuestions: ["Which staff workflow is affected?"], problemFraming: "Clarify the request before deciding delivery scope.", constraintsAndNonGoals: [], successCriteria: ["Staff can understand the request."], confidence: "medium", unknowns: [], suggestedGoalId: "G-001", suggestedMilestoneId: "M-001", overlappingProductChangeNumbers: [12], technicalImpact: "Potential staff workflow impact only." }

vi.mock("@/lib/governance-projection/freshness", () => ({ isGovernanceProjectionStale: vi.fn(() => state.stale) }))
vi.mock("@/lib/ai/config", () => ({ WAVE_AI_MODEL: "test-model", WAVE_AI_REASONING_EFFORT: "max" }))
vi.mock("@/lib/ai/pdr-capability-catalogue", () => ({ PDR_CAPABILITY_CATALOGUE_VERSION: "test", PDR_CAPABILITY_CATALOGUE: [{ id: "capability-a", title: "Allowed capability" }] }))
vi.mock("@/lib/ai/openai-client", () => ({ getWaveAiOpenAiClient: vi.fn(() => ({ responses: { parse: vi.fn(async (input: unknown) => { state.calls.push(input); return { output_parsed: state.stale ? { ...draft, suggestedGoalId: null, suggestedMilestoneId: null, overlappingProductChangeNumbers: [], technicalImpact: null } : draft, usage: undefined } }) } })) }))

import { generatePdrScreening } from "@/lib/ai/pdr-screening"

function current() { return { state: "available" as const, snapshotId: "123e4567-e89b-42d3-a456-426614174000", digest: "a".repeat(64), projection: { registryRevision: "r1", snapshotAt: "2026-08-30T00:00:00.000Z", registry: { goals: [{ id: "G-001", title: "Goal title", statement: "Allowed strategy statement" }], milestones: [{ id: "M-001", goalId: "G-001", title: "Milestone", outcome: "Allowed outcome", lifecycle: "active" }], guardrails: [{ title: "Guardrail", rule: "Allowed rule", lifecycle: "active" }] }, issues: [{ number: 12, kind: "Product Change", title: "Allowed product change", projectStatus: "Todo", placement: { goalId: "G-001", milestoneId: "M-001" }, provenance: { state: "verified" }, body: "This must never be sent", assignees: ["private"] }] } } as any }

beforeEach(() => { state.stale = false; state.calls = [] })

describe("PDR screening provider contract", () => {
  it("sends only compact allowlisted request and governance fields with an opaque safety id", async () => {
    await generatePdrScreening({ request: { id: "private-request-id", title: "Useful request", originalText: "Original request wording" }, current: current(), safetyIdentifier: "opaque-telemetry-id" })
    const call = state.calls[0]
    expect(call).toMatchObject({ model: "test-model", store: false, parallel_tool_calls: false, safety_identifier: "opaque-telemetry-id" })
    const input = JSON.parse(call.input)
    expect(input).toMatchObject({ request: { title: "Useful request", originalWording: "Original request wording" }, context: { registryRevision: "r1", goals: [{ id: "G-001" }], productChanges: [{ number: 12 }] } })
    expect(JSON.stringify(input)).not.toContain("private-request-id")
    expect(JSON.stringify(input)).not.toContain("This must never be sent")
  })

  it("structurally removes strategic context when stale", async () => {
    state.stale = true
    await generatePdrScreening({ request: { id: "private-request-id", title: "Useful request", originalText: "Original request wording" }, current: current(), safetyIdentifier: "opaque-telemetry-id" })
    const input = JSON.parse(state.calls[0].input)
    expect(input.context).toEqual({ mode: "stale" })
    expect(input.request.clarificationAnswers).toEqual([])
    expect(JSON.stringify(input)).not.toContain("Allowed capability")
    expect(JSON.stringify(input)).not.toContain("Allowed strategy statement")
    expect(JSON.stringify(input)).not.toContain("Allowed product change")
    expect(state.calls[0].instructions).toContain("Set suggestedGoalId")
  })

  it("fails before the provider when governance cannot be compacted safely", async () => {
    const oversized = current()
    oversized.projection.registry.goals = Array.from({ length: 31 }, (_, index) => ({ id: `G-${String(index).padStart(3, "0")}`, title: "Goal", statement: "Statement" }))
    await expect(generatePdrScreening({ request: { id: "private-request-id", title: "Useful request", originalText: "Original request wording" }, current: oversized, safetyIdentifier: "opaque-telemetry-id" })).rejects.toThrow("cannot be compacted safely")
    expect(state.calls).toEqual([])
  })
})
