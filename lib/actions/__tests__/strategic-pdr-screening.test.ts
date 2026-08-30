import { beforeEach, describe, expect, it, vi } from "vitest"

const requestId = "123e4567-e89b-42d3-a456-426614174000"
const snapshotId = "223e4567-e89b-42d3-a456-426614174000"
const generationId = "323e4567-e89b-42d3-a456-426614174000"
const draft = {
  classification: "needs_clarification", affectedUsers: "Staff members", desiredOutcome: "A clear request", successSignal: "Staff can understand it.",
  clarificationQuestions: ["Which staff workflow is affected?"], problemFraming: "Clarify the request before deciding delivery scope.", constraintsAndNonGoals: [], successCriteria: ["Staff can understand the request."], confidence: "medium", unknowns: [],
  suggestedGoalId: "G-001", suggestedMilestoneId: "M-001", overlappingProductChangeNumbers: [12], technicalImpact: "Potential staff workflow impact only.",
} as const

const state = vi.hoisted(() => ({
  access: { user: { id: "staff-user" }, role: "staff" },
  current: null as any,
  request: null as any,
  generated: null as any,
  generateError: null as unknown,
  started: { generationId: "323e4567-e89b-42d3-a456-426614174000", traceId: "trace", startedAt: "2026-08-30T00:00:00.000Z" } as any,
  startError: null as unknown,
  failError: null as unknown,
  calls: { history: 0, projection: 0, generate: [] as any[], start: 0, complete: 0, fail: 0, inserts: [] as any[], revalidate: [] as string[] },
  insertError: null as any,
}))

vi.mock("@/lib/access-control", () => ({ requireStaffAccess: vi.fn(async () => { if (!state.access) throw new Error("Unauthorized"); return state.access }) }))
vi.mock("@/lib/pdr/intake-server", () => ({
  getPdrRequestHistory: vi.fn(async () => { state.calls.history++; return state.request }),
  assertPdrAttachment: vi.fn(), pdrAttachmentPath: vi.fn(), PDR_ATTACHMENT_BUCKET: "pdr-intake-attachments", canDispositionPdr: vi.fn(),
}))
vi.mock("@/lib/governance-projection/server", () => ({ readCurrentGovernanceProjection: vi.fn(async () => { state.calls.projection++; return state.current }) }))
vi.mock("@/lib/governance-projection/freshness", () => ({ isGovernanceProjectionStale: vi.fn((at: string) => at === "stale") }))
vi.mock("@/lib/ai/pdr-screening", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/pdr-screening")>("@/lib/ai/pdr-screening")
  return { ...actual, generatePdrScreening: vi.fn(async (input: unknown) => {
    state.calls.generate.push(input)
    if (state.generateError) throw state.generateError
    return state.generated
  }) }
})
vi.mock("@/lib/ai/ledger", () => ({
  startWaveAiRun: vi.fn(async () => { state.calls.start++; if (state.startError) throw state.startError; return state.started }),
  completeWaveAiRun: vi.fn(async () => { state.calls.complete++ }),
  failWaveAiRun: vi.fn(async () => { state.calls.fail++; if (state.failError) throw state.failError }),
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from: (table: string) => ({ insert: async (value: unknown) => { state.calls.inserts.push({ table, value }); return { error: state.insertError } } }) })) }))
vi.mock("@/lib/telemetry/identity", () => ({ getOpaqueTelemetryUserId: vi.fn(() => "opaque-telemetry-id") }))
vi.mock("@/lib/ai/usage", () => ({ normalizeWaveAiUsage: vi.fn(() => ({ inputTokens: 1, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1, reasoningTokens: 0 })), estimateWaveAiCostUsd: vi.fn(() => 0) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn((path: string) => state.calls.revalidate.push(path)) }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

import { generateStrategicPdrScreening, saveStrategicPdrScreening } from "@/lib/actions/strategic-pdr"

function form(extra: Record<string, string> = {}) { const value = new FormData(); value.set("request_id", requestId); for (const [key, item] of Object.entries(extra)) value.set(key, item); return value }
function current(snapshotAt = "2026-08-30T00:00:00.000Z") { return { state: "available", snapshotId, digest: "a".repeat(64), projection: { registryRevision: "r1", snapshotAt, registry: { goals: [{ id: "G-001" }], milestones: [{ id: "M-001", goalId: "G-001", lifecycle: "active" }] }, issues: [{ number: 12, kind: "Product Change" }] } } }
function request(overrides: Record<string, unknown> = {}) { return { id: requestId, title: "Useful request", originalText: "Original wording must stay only in the canonical request.", provenance: "proposal", intakeProvenance: "wave_staff_v1", requester: { actor: "Staff", userId: "staff-user" }, screening: { status: "draft" }, disposition: { kind: null }, ...overrides } }

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-pdr-preview-secret"
  state.access = { user: { id: "staff-user" }, role: "staff" }; state.current = current(); state.request = request()
  state.generated = { draft: { ...draft }, context: { snapshotId, digest: "a".repeat(64), registryRevision: "r1", snapshotAt: "2026-08-30T00:00:00.000Z", freshness: "fresh" }, usage: undefined }
  state.generateError = null; state.startError = null; state.failError = null; state.insertError = null
  state.calls = { history: 0, projection: 0, generate: [], start: 0, complete: 0, fail: 0, inserts: [], revalidate: [] }
})

describe("Strategic PDR AI screening actions", () => {
  it("authenticates before reading governance, request history, ledger, or provider", async () => {
    state.access = null as any
    await expect(generateStrategicPdrScreening(form())).rejects.toThrow()
    expect(state.calls).toMatchObject({ projection: 0, history: 0, start: 0 })
  })

  it("fails closed on an unavailable governance projection before request, ledger, or provider", async () => {
    state.current = { state: "unavailable" }
    await expect(generateStrategicPdrScreening(form())).rejects.toThrow("GitHub governance snapshot is unavailable")
    expect(state.calls).toMatchObject({ history: 0, start: 0 })
    expect(state.calls.generate).toEqual([])
  })

  it.each([
    ["legacy provenance", { intakeProvenance: "legacy" }],
    ["a non-staff requester", { requester: { actor: "Founder", userId: "staff-user" } }],
    ["a missing requester identity", { requester: { actor: "Staff", userId: null } }],
    ["a non-draft request", { screening: { status: "review" } }],
    ["an already disposed request", { disposition: { kind: "approved" } }],
    ["a non-proposal history record", { provenance: "request" }],
  ])("enforces the exact screenable eligibility contract for %s", async (_label, override) => {
    state.request = request(override)
    await expect(generateStrategicPdrScreening(form())).rejects.toThrow("Only authenticated WAVE staff requests")
    expect(state.calls).toMatchObject({ start: 0 })
    expect(state.calls.generate).toEqual([])
  })

  it("starts only a PDR screening run and sends the opaque telemetry identifier to the allowlisted generator", async () => {
    const result = await generateStrategicPdrScreening(form())
    expect(result.previewToken).toMatch(/^v3\./)
    expect(state.calls.start).toBe(1)
    expect(state.calls.generate[0]).toMatchObject({ safetyIdentifier: "opaque-telemetry-id", request: { id: requestId, title: "Useful request" } })
    expect(state.calls.generate[0]).not.toHaveProperty("attachments")
    expect(state.calls.complete).toBe(1)
    expect(state.calls.inserts).toEqual([])
  })

  it("returns a generic error and never saves when admission, provider, output, or failure accounting fails", async () => {
    for (const failure of [new Error("rate limited"), new SyntaxError("invalid output")]) {
      state.generateError = failure; state.failError = new Error("ledger unavailable")
      await expect(generateStrategicPdrScreening(form())).rejects.toThrow("The screening preview could not be generated. No screening was saved.")
      expect(state.calls.inserts).toEqual([])
      state.generateError = null; state.failError = null; state.calls.generate = []; state.calls.inserts = []
    }
    state.startError = new Error("rate limited")
    await expect(generateStrategicPdrScreening(form())).rejects.toThrow("The screening preview could not be generated. No screening was saved.")
    expect(state.calls.inserts).toEqual([])
  })

  it("binds refinement answers to the signed prior questions and current snapshot", async () => {
    const first = await generateStrategicPdrScreening(form())
    await generateStrategicPdrScreening(form({ clarification_answers: JSON.stringify([{ question: draft.clarificationQuestions[0], answer: "The staff intake desk." }]), prior_draft: JSON.stringify(draft), prior_preview_token: first.previewToken }))
    expect(state.calls.generate[1]).toMatchObject({ answers: [{ question: draft.clarificationQuestions[0], answer: "The staff intake desk." }] })
    await expect(generateStrategicPdrScreening(form({ clarification_answers: JSON.stringify([{ question: "Forged question?", answer: "No" }]), prior_draft: JSON.stringify(draft), prior_preview_token: first.previewToken }))).rejects.toThrow("Clarification answers are invalid")
    state.access = { user: { id: "different-staff-user" }, role: "staff" }
    await expect(generateStrategicPdrScreening(form({ clarification_answers: JSON.stringify([{ question: draft.clarificationQuestions[0], answer: "The staff intake desk." }]), prior_draft: JSON.stringify(draft), prior_preview_token: first.previewToken }))).rejects.toThrow("Clarification answers are invalid")
  })

  it("requires an explicit, current, sealed preview to save and persists no original request body", async () => {
    const preview = await generateStrategicPdrScreening(form())
    await saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft })
    const inserted = state.calls.inserts[0]
    expect(inserted.table).toBe("wave_pdr_screening_records")
    expect(JSON.stringify(inserted.value)).not.toContain("Original wording must stay only")
    expect(inserted.value).toMatchObject({ proposal_id: requestId, generation_id: generationId })
    expect(state.calls.revalidate).toContain(`/strategic-pdr/requests/${requestId}`)
  })

  it("authenticates save before governance, history, or database access", async () => {
    state.access = null as any
    await expect(saveStrategicPdrScreening({ requestId, previewToken: "not-a-valid-preview-token-but-long-enough", draft })).rejects.toThrow()
    expect(state.calls).toMatchObject({ projection: 0, history: 0, inserts: [] })
  })

  it("keeps ordinary persistence errors generic and performs no delivery mutation", async () => {
    const preview = await generateStrategicPdrScreening(form())
    state.insertError = { code: "unexpected_storage_error", message: "private database details" }
    await expect(saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft })).rejects.toThrow("The screening could not be saved.")
    expect(state.calls.inserts).toHaveLength(1)
  })

  it.each([
    ["legacy provenance", { intakeProvenance: "legacy" }],
    ["a non-staff requester", { requester: { actor: "Founder", userId: "staff-user" } }],
    ["a missing requester identity", { requester: { actor: "Staff", userId: null } }],
    ["a non-draft request", { screening: { status: "review" } }],
    ["an already disposed request", { disposition: { kind: "approved" } }],
    ["a non-proposal history record", { provenance: "request" }],
  ])("rechecks save eligibility for %s", async (_label, override) => {
    const preview = await generateStrategicPdrScreening(form())
    state.request = request(override)
    await expect(saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft })).rejects.toThrow("Only authenticated WAVE staff requests")
    expect(state.calls.inserts).toEqual([])
  })

  it("rejects replay and a changed snapshot without another delivery mutation", async () => {
    const preview = await generateStrategicPdrScreening(form())
    state.insertError = { code: "23505" }
    await expect(saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft })).rejects.toThrow("This preview was already saved")
    state.insertError = null; state.current = current("stale")
    await expect(saveStrategicPdrScreening({ requestId, previewToken: preview.previewToken, draft })).rejects.toThrow("governance context changed")
    expect(state.calls.inserts).toHaveLength(1)
  })
})
