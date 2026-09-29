import { describe, expect, it } from "vitest"
import { validateFeedbackSubmission } from "@/lib/repreneur-feedback/validation"

const valid = {
  category: "difficulty",
  message: "The form could be easier to follow.",
  context: "portal_profile",
}

describe("minimum repreneur feedback payload", () => {
  it("keeps only the selected coarse context and trims the message", () => {
    expect(validateFeedbackSubmission({ ...valid, message: `  ${valid.message}  ` })).toEqual({
      ok: true,
      value: { ...valid },
    })
  })

  it.each(["userId", "repreneurId", "createdAt", "status", "dealId", "url", "query", "referrer", "attachment"])(
    "rejects unexpected %s rather than silently storing or trusting it",
    (field) => {
      expect(validateFeedbackSubmission({ ...valid, [field]: "forged" }).ok).toBe(false)
    },
  )

  it.each(["/portal/deals/secret", "portal_deals?deal=secret", "portal_document", "https://example.test"])(
    "rejects unapproved page context %s",
    (context) => {
      expect(validateFeedbackSubmission({ ...valid, context }).ok).toBe(false)
    },
  )

  it("accepts absent context and rejects non-enumerated categories", () => {
    expect(validateFeedbackSubmission({ category: "other", message: valid.message })).toMatchObject({
      ok: true, value: { context: null },
    })
    expect(validateFeedbackSubmission({ ...valid, category: "urgent" }).ok).toBe(false)
  })

  it("enforces length after trim and counts Unicode characters like PostgreSQL", () => {
    expect(validateFeedbackSubmission({ ...valid, message: " ".repeat(100) }).ok).toBe(false)
    expect(validateFeedbackSubmission({ ...valid, message: "a".repeat(19) }).ok).toBe(false)
    expect(validateFeedbackSubmission({ ...valid, message: "a".repeat(1001) }).ok).toBe(false)
    expect(validateFeedbackSubmission({ ...valid, message: "😀".repeat(20) }).ok).toBe(true)
  })
})
