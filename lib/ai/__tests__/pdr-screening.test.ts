import { describe, expect, it } from "vitest"
import { validatePdrScreeningDraft } from "@/lib/ai/pdr-screening"
import { createPdrScreeningPreviewToken, pdrScreeningDraftDigest, validatePdrScreeningPreviewToken } from "@/lib/ai/pdr-screening-preview-token"
import type { PdrScreeningDraft } from "@/lib/ai/pdr-screening-contract"

const current = { state: "available" as const, snapshotId: "11111111-1111-4111-8111-111111111111", digest: "a".repeat(64), projection: {
  registryRevision: "r1", snapshotAt: "2026-08-30T00:00:00.000Z", registry: {
    goals: [{ id: "G-001" }], milestones: [{ id: "M-001", goalId: "G-001", lifecycle: "active" }],
  }, issues: [{ number: 12, kind: "Product Change" }],
} } as never
const valid: PdrScreeningDraft = { classification: "needs_clarification", affectedUsers: "Staff members", desiredOutcome: "A clear request", successSignal: "Staff can understand the request.", clarificationQuestions: ["Which users are in scope?"], problemFraming: "Clarify the request before deciding delivery scope.", constraintsAndNonGoals: [], successCriteria: ["A staff member can understand the request."], confidence: "medium", unknowns: [], suggestedGoalId: "G-001", suggestedMilestoneId: "M-001", overlappingProductChangeNumbers: [12], technicalImpact: "Potential staff workflow impact only." }

describe("PDR screening validation", () => {
  const completeBug: PdrScreeningDraft = { ...valid, classification: "bug", clarificationQuestions: [], problemFraming: "The portal intermittently fails after a valid staff action." }

  it("accepts a complete bug without a forced clarification", () => {
    expect(validatePdrScreeningDraft(completeBug, current, "fresh").clarificationQuestions).toEqual([])
  })

  it("allows no more than two relevant bug questions and retains the non-bug minimum", () => {
    const roleSpecificIntermittentBug = {
      ...completeBug,
      clarificationQuestions: ["Which staff role sees the issue?", "How often does it recur?"],
    }
    expect(validatePdrScreeningDraft(roleSpecificIntermittentBug, current, "fresh").clarificationQuestions).toHaveLength(2)
    expect(() => validatePdrScreeningDraft({ ...completeBug, clarificationQuestions: ["Which page shows the issue?", "What did you expect to happen?", "When did it first occur?"] }, current, "fresh")).toThrow()
    // An unclear product request keeps the existing 1–5 clarification path.
    expect(() => validatePdrScreeningDraft({ ...valid, clarificationQuestions: [] }, current, "fresh")).toThrow()
  })

  it("rejects a clarification that requests a secret or unnecessary personal detail", () => {
    for (const question of ["What is the affected user's password?", "What is the affected user's email address?"]) {
      try {
        validatePdrScreeningDraft({ ...completeBug, clarificationQuestions: [question] }, current, "fresh")
        throw new Error("unsafe question was accepted")
      } catch (error) {
        expect(error).toMatchObject({ reason: "unsafe_clarification_question" })
      }
    }
  })

  it("rejects duplicate questions", () => {
    expect(() => validatePdrScreeningDraft({ ...valid, clarificationQuestions: [valid.clarificationQuestions[0], valid.clarificationQuestions[0]] }, current, "fresh")).toThrow()
  })
  it("rejects Ticket overlap and mismatched placement", () => {
    expect(() => validatePdrScreeningDraft({ ...valid, overlappingProductChangeNumbers: [99] }, current, "fresh")).toThrow()
    expect(() => validatePdrScreeningDraft({ ...valid, suggestedGoalId: "G-999" }, current, "fresh")).toThrow()
  })
  it("removes strategic claims when context is stale", () => {
    expect(() => validatePdrScreeningDraft(valid, current, "stale")).toThrow()
    expect(validatePdrScreeningDraft({ ...valid, suggestedGoalId: null, suggestedMilestoneId: null, overlappingProductChangeNumbers: [], technicalImpact: null }, current, "stale").suggestedGoalId).toBeNull()
  })
  it("seals a preview token to actor, request, draft and expiry", () => {
    const previous = process.env.BETTER_AUTH_SECRET
    process.env.BETTER_AUTH_SECRET = "test-secret"
    const token = createPdrScreeningPreviewToken({ generationId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222", context: { snapshotId: "33333333-3333-4333-8333-333333333333", digest: "b".repeat(64), registryRevision: "r1", snapshotAt: "2026-08-30T00:00:00.000Z", freshness: "fresh" }, draftDigest: pdrScreeningDraftDigest(valid) }, "actor-a", 10)
    expect(token).toMatch(/^v3\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(token).not.toContain("actor-a")
    expect(token).not.toContain("G-001")
    expect(token).not.toContain("22222222-2222-4222-8222-222222222222")
    expect(validatePdrScreeningPreviewToken(token, { actor: "actor-a", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: pdrScreeningDraftDigest(valid) }, 20)?.generationId).toBe("11111111-1111-4111-8111-111111111111")
    expect(validatePdrScreeningPreviewToken(token, { actor: "actor-b", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: pdrScreeningDraftDigest(valid) }, 20)).toBeNull()
    expect(validatePdrScreeningPreviewToken(`${token}x`, { actor: "actor-a", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: pdrScreeningDraftDigest(valid) }, 20)).toBeNull()
    expect(validatePdrScreeningPreviewToken(token, { actor: "actor-a", requestId: "44444444-4444-4444-8444-444444444444", draftDigest: pdrScreeningDraftDigest(valid) }, 20)).toBeNull()
    expect(validatePdrScreeningPreviewToken(token, { actor: "actor-a", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: "c".repeat(64) }, 20)).toBeNull()
    expect(validatePdrScreeningPreviewToken("v3.bad.tag.cipher", { actor: "actor-a", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: pdrScreeningDraftDigest(valid) }, 20)).toBeNull()
    expect(validatePdrScreeningPreviewToken(token, { actor: "actor-a", requestId: "22222222-2222-4222-8222-222222222222", draftDigest: pdrScreeningDraftDigest(valid) }, 601_000)).toBeNull()
    process.env.BETTER_AUTH_SECRET = previous
  })
})
