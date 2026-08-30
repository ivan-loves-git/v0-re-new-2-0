import { describe, expect, it } from "vitest"
import { validatePdrScreeningDraft } from "@/lib/ai/pdr-screening"

const current = { state: "available" as const, snapshotId: "11111111-1111-4111-8111-111111111111", digest: "a".repeat(64), projection: {
  registryRevision: "r1", snapshotAt: "2026-08-30T00:00:00.000Z", registry: {
    goals: [{ id: "G-001" }], milestones: [{ id: "M-001", goalId: "G-001", lifecycle: "active" }],
  }, issues: [{ number: 12, kind: "Product Change" }],
} } as never
const original = "Keep the original requester wording exactly as submitted."
const valid = { preservedOriginalWording: original, clarificationQuestions: ["Which users are in scope?"], problemFraming: "Clarify the request before deciding delivery scope.", constraintsAndNonGoals: [], successCriteria: ["A staff member can understand the request."], confidence: "medium", unknowns: [], suggestedGoalId: "G-001", suggestedMilestoneId: "M-001", overlappingProductChangeNumbers: [12], technicalImpact: "Potential staff workflow impact only." }

describe("PDR screening validation", () => {
  it("rejects altered original wording and duplicate questions", () => {
    expect(() => validatePdrScreeningDraft({ ...valid, preservedOriginalWording: "changed" }, current, original, "fresh")).toThrow()
    expect(() => validatePdrScreeningDraft({ ...valid, clarificationQuestions: [valid.clarificationQuestions[0], valid.clarificationQuestions[0]] }, current, original, "fresh")).toThrow()
  })
  it("rejects Ticket overlap and mismatched placement", () => {
    expect(() => validatePdrScreeningDraft({ ...valid, overlappingProductChangeNumbers: [99] }, current, original, "fresh")).toThrow()
    expect(() => validatePdrScreeningDraft({ ...valid, suggestedGoalId: "G-999" }, current, original, "fresh")).toThrow()
  })
  it("removes strategic claims when context is stale", () => {
    expect(() => validatePdrScreeningDraft(valid, current, original, "stale")).toThrow()
    expect(validatePdrScreeningDraft({ ...valid, suggestedGoalId: null, suggestedMilestoneId: null, overlappingProductChangeNumbers: [], technicalImpact: null }, current, original, "stale").suggestedGoalId).toBeNull()
  })
})
