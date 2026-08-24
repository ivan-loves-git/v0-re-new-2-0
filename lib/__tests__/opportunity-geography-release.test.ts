import { afterEach, describe, expect, it } from "vitest"

import { isFranceGeographyMandatesEnabled } from "../opportunity-geography-release"

const priorReleaseFlag = process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED
const priorExecutionMode = process.env.QA_EXECUTION_MODE

afterEach(() => {
  if (priorReleaseFlag === undefined) {
    delete process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED
  } else {
    process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = priorReleaseFlag
  }

  if (priorExecutionMode === undefined) {
    delete process.env.QA_EXECUTION_MODE
  } else {
    process.env.QA_EXECUTION_MODE = priorExecutionMode
  }
})

describe("France geography mandate release", () => {
  it("keeps ordinary runtimes on the explicit release switch", () => {
    delete process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED
    delete process.env.QA_EXECUTION_MODE

    expect(isFranceGeographyMandatesEnabled()).toBe(false)

    process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = "true"
    expect(isFranceGeographyMandatesEnabled()).toBe(true)
  })

  it("always exercises the canonical path in protected GitHub QA", () => {
    process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = "false"
    process.env.QA_EXECUTION_MODE = "github-runner"

    expect(isFranceGeographyMandatesEnabled()).toBe(true)
  })
})
