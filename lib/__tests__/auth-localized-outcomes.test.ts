import { describe, expect, it } from "vitest"
import { signInErrorCopy } from "@/lib/i18n/auth-outcomes"
import { uiCopy } from "@/lib/i18n/ui-copy"

describe("public sign-in outcomes", () => {
  it("gives a controlled credential response in both languages", () => {
    const key = signInErrorCopy({ code: "INVALID_EMAIL_OR_PASSWORD" })
    expect(uiCopy("en", key)).toBe("Email or password is incorrect.")
    expect(uiCopy("fr", key)).toBe("L’adresse e-mail ou le mot de passe est incorrect.")
  })

  it("does not expose unexpected provider details", () => {
    const key = signInErrorCopy({ code: "PRIVATE_DB_ERROR", status: 500 })
    expect(uiCopy("en", key)).toBe("Sign-in is temporarily unavailable. Please try again.")
    expect(uiCopy("fr", key)).toBe("La connexion est temporairement indisponible. Réessayez.")
  })
})
