import { describe, expect, it } from "vitest"
import { sectorUiLabel, geographyUiLabel, thesisOptionUiLabel } from "@/lib/i18n/canonical-labels"

describe("canonical display labels", () => {
  it("changes only the displayed label for a known sector", () => {
    const stored = "Industrie manufacturière"
    expect(sectorUiLabel(stored, "en")).toBe("Manufacturing")
    expect(stored).toBe("Industrie manufacturière")
  })

  it("keeps unknown custom values unchanged in both languages", () => {
    expect(sectorUiLabel("Custom niche", "fr")).toBe("Custom niche")
    expect(sectorUiLabel("Custom niche", "en")).toBe("Custom niche")
    expect(geographyUiLabel("Custom region", "en")).toBe("Custom region")
    expect(thesisOptionUiLabel("legacy", "Original custom label", "en")).toBe("Original custom label")
  })
})
