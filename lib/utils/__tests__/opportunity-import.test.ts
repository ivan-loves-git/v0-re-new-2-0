import { describe, expect, it } from "vitest"
import {
  directOpportunityImportDisabled,
  OPPORTUNITY_DIRECT_IMPORT_DISABLED,
  parseDelimitedOpportunityRows,
} from "@/lib/utils/opportunity-import"

describe("retired direct opportunity importer", () => {
  it("does not parse rows or permit a legacy direct-import fallback", () => {
    expect(() => directOpportunityImportDisabled()).toThrow(
      OPPORTUNITY_DIRECT_IMPORT_DISABLED,
    )
    expect(() => parseDelimitedOpportunityRows()).toThrow(
      OPPORTUNITY_DIRECT_IMPORT_DISABLED,
    )
  })
})
