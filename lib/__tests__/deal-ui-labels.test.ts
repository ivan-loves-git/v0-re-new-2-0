import { describe, expect, it } from "vitest"
import { declineReasonUiLabel, matchStatusUiLabel, pursuitStageUiLabel } from "@/lib/i18n/deal-labels"

describe("controlled opportunity labels", () => {
  it("keeps interest, withdrawal, decline and pursuit distinct", () => {
    expect(matchStatusUiLabel("interested", "fr")).toBe("Intérêt envoyé")
    expect(matchStatusUiLabel("withdrawn", "fr")).toBe("Intérêt retiré")
    expect(matchStatusUiLabel("declined", "fr")).toBe("Écartée")
    expect(matchStatusUiLabel("dropped", "fr")).toBe("Dossier de reprise interrompu")
    expect(pursuitStageUiLabel("nda_signed", "fr")).toBe("NDA signé")
  })

  it("leaves unknown original values intact", () => {
    expect(declineReasonUiLabel("custom retained reason", "fr")).toBe("custom retained reason")
    expect(declineReasonUiLabel("sector", "en")).toBe("Industry / sector")
  })
})
