import { describe, expect, it } from "vitest"
import {
  clearIntakeDraft,
  createIntakeDraft,
  INTAKE_DRAFT_STORAGE_KEY,
  restoreIntakeDraft,
} from "@/lib/utils/intake-draft"

describe("intake draft", () => {
  it("restores safe answers and the current step after a same-tab refresh", () => {
    const raw = createIntakeDraft(4, {
      first_name: "QA",
      email: "qa@example.invalid",
      q12_geo_zones: ["ile-de-france"],
      marketing_consent: true,
    })

    expect(restoreIntakeDraft(raw)).toEqual({
      currentStep: 4,
      data: {
        first_name: "QA",
        email: "qa@example.invalid",
        q12_geo_zones: ["ile-de-france"],
        marketing_consent: true,
      },
      requiresCvReattachment: false,
      discardedThesisAttachment: false,
    })
  })

  it("does not persist uploaded-document URLs and requires the CV to be attached again", () => {
    const raw = createIntakeDraft(5, {
      first_name: "QA",
      cv_url: "https://storage.example.invalid/cv.pdf",
      q18_investment_thesis_url: "https://storage.example.invalid/thesis.pdf",
    })

    expect(restoreIntakeDraft(raw)).toEqual({
      currentStep: 5,
      data: { first_name: "QA" },
      requiresCvReattachment: true,
      discardedThesisAttachment: true,
    })
  })

  it("rejects malformed, stale, and out-of-range stored payloads", () => {
    expect(restoreIntakeDraft("not json")).toBeNull()
    expect(restoreIntakeDraft(JSON.stringify({ version: 0, currentStep: 2, data: {} }))).toBeNull()
    expect(restoreIntakeDraft(JSON.stringify({ version: 1, currentStep: 7, data: {} }))).toBeNull()
    expect(restoreIntakeDraft(JSON.stringify({ version: 1, currentStep: 2, data: [] }))).toBeNull()
  })

  it("clears the same-tab draft only after a confirmed submission", () => {
    const removed: string[] = []

    clearIntakeDraft({ removeItem: (key) => removed.push(key) })

    expect(removed).toEqual([INTAKE_DRAFT_STORAGE_KEY])
  })
})
