import { describe, expect, it } from "vitest"
import { displayLocale, parseUiLanguage, resolveUiLanguage } from "@/lib/i18n/ui-language"

describe("repreneur UI language", () => {
  it("uses an explicit account choice before a stale browser choice", () => {
    expect(resolveUiLanguage("fr", "en")).toBe("fr")
    expect(resolveUiLanguage("en", "fr")).toBe("en")
  })

  it("uses a valid browser choice only when the account has none, then French", () => {
    expect(resolveUiLanguage(null, "en")).toBe("en")
    expect(resolveUiLanguage(null, "fr")).toBe("fr")
    expect(resolveUiLanguage(null, "de")).toBe("fr")
    expect(resolveUiLanguage(null, null)).toBe("fr")
  })

  it("rejects unsupported values and uses display conventions without changing business data", () => {
    expect(parseUiLanguage("EN")).toBeNull()
    expect(parseUiLanguage("fr")).toBe("fr")
    expect(displayLocale("fr")).toBe("fr-FR")
    expect(displayLocale("en")).toBe("en-GB")
  })
})
