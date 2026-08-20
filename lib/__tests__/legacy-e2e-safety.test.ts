import { describe, expect, it } from "vitest"

import { assertLegacyE2ESafeToRun } from "../../scripts/e2e-tests/safety"

describe("legacy E2E safety boundary", () => {
  it("is disabled by default even for a local URL", () => {
    expect(() =>
      assertLegacyE2ESafeToRun({ E2E_BASE_URL: "http://localhost:3000" }),
    ).toThrow("Legacy E2E harness is disabled")
  })

  it("refuses the old mutating harness unless every explicit local-only acknowledgement is present", () => {
    expect(() =>
      assertLegacyE2ESafeToRun({
        E2E_BASE_URL: "https://app.re-new.team",
        E2E_LEGACY_UNSAFE_ENABLED: "I_UNDERSTAND_THIS_IS_LEGACY",
        E2E_ALLOW_DATA_MUTATION:
          "I_UNDERSTAND_THIS_WILL_CREATE_AND_DELETE_TEST_DATA",
      }),
    ).toThrow("local development URL")
  })

  it("permits the quarantined harness only for explicit local development rehearsal", () => {
    expect(() =>
      assertLegacyE2ESafeToRun({
        E2E_BASE_URL: "http://localhost:3000",
        E2E_LEGACY_UNSAFE_ENABLED: "I_UNDERSTAND_THIS_IS_LEGACY",
        E2E_ALLOW_DATA_MUTATION:
          "I_UNDERSTAND_THIS_WILL_CREATE_AND_DELETE_TEST_DATA",
      }),
    ).not.toThrow()
  })
})
