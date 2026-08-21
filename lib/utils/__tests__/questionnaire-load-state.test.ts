import { describe, expect, it } from "vitest"
import { questionnaireLoadStateForResponse } from "@/lib/utils/questionnaire-load-state"

describe("questionnaire load state", () => {
  it("keeps an unknown repreneur out of the empty questionnaire view", () => {
    expect(questionnaireLoadStateForResponse({ ok: false, status: 404 })).toEqual("not_found")
    expect(questionnaireLoadStateForResponse({ ok: false, status: 500 })).toEqual("error")
    expect(questionnaireLoadStateForResponse({ ok: true, status: 200 })).toEqual("ready")
  })
})
