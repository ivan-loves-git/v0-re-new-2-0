import { describe, expect, it } from "vitest"
import { buildPasswordResetBrowserUrl } from "@/lib/password-reset-browser-url"

const token = "aB3dE5gH7jK9mN2pQ4sT6vX8"

describe("password reset browser URL", () => {
  it.each([
    [false, null],
    [true, "portal"],
  ])("keeps the reset credential in the fragment", (portal, intent) => {
    const result = buildPasswordResetBrowserUrl(
      "https://app.re-new.team",
      token,
      portal,
    )
    const url = new URL(result)

    expect(url.origin).toBe("https://app.re-new.team")
    expect(url.pathname).toBe("/auth/reset-password")
    expect(url.searchParams.get("intent")).toBe(intent)
    expect(url.searchParams.has("token")).toBe(false)
    expect(url.pathname).not.toContain(token)
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe(token)
  })

  it("rejects a malformed credential before building an email link", () => {
    expect(() =>
      buildPasswordResetBrowserUrl(
        "https://app.re-new.team",
        "not-a-reset-token",
        false,
      ),
    ).toThrow("Invalid password-reset token format.")
  })
})
