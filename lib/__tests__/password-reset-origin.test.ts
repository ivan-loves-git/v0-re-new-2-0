import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  RENEW_PRODUCTION_ORIGIN,
  RENEW_PROTECTED_QA_ORIGIN,
  trustedAuthOrigins,
  validatePasswordResetDeliveryUrl,
} from "@/lib/auth-origin-policy"

const resetUrl = (origin: string, callback: string) =>
  `${origin}/api/auth/reset-password/synthetic-token?callbackURL=${encodeURIComponent(callback)}`

describe("W-151 password-reset origin boundary", () => {
  it.each([
    [RENEW_PRODUCTION_ORIGIN, "production" as const],
    [RENEW_PROTECTED_QA_ORIGIN, "production" as const],
    ["http://localhost:3000", "development" as const],
    ["https://127.0.0.1:3443", "test" as const],
  ])("accepts the explicit owned or local verification origin %s", (origin, runtime) => {
    expect(trustedAuthOrigins(origin, runtime)).toContain(origin)
  })

  it.each([
    "https://attacker.vercel.app",
    "https://preview.v0.dev",
    "https://app.re-new.team.attacker.example",
    "http://app.re-new.team",
    "https://user:password@app.re-new.team",
    "https://app.re-new.team/path",
    "not-a-url",
  ])("rejects an unowned configured production origin: %s", (origin) => {
    expect(() => trustedAuthOrigins(origin, "production")).toThrow(
      "Auth origin rejected",
    )
  })

  it("rejects local verification origins in production", () => {
    expect(() => trustedAuthOrigins("http://localhost:3000", "production")).toThrow(
      "Auth origin rejected",
    )
  })

  it("allows the exact TLS loopback only in protected QA mode", () => {
    expect(
      trustedAuthOrigins(
        "https://127.0.0.1:3443",
        "production",
        "protected",
      ),
    ).toContain("https://127.0.0.1:3443")
    expect(() =>
      trustedAuthOrigins("https://127.0.0.1:3443", "production"),
    ).toThrow("Auth origin rejected")
  })

  it.each([
    "/auth/reset-password",
    "/auth/reset-password?intent=portal",
    `${RENEW_PRODUCTION_ORIGIN}/auth/reset-password`,
  ])("accepts a controlled reset callback: %s", (callback) => {
    expect(
      validatePasswordResetDeliveryUrl(
        resetUrl(RENEW_PRODUCTION_ORIGIN, callback),
        RENEW_PRODUCTION_ORIGIN,
        "production",
      ),
    ).toContain("synthetic-token")
  })

  it.each([
    resetUrl("https://attacker.vercel.app", "/auth/reset-password"),
    resetUrl(
      RENEW_PRODUCTION_ORIGIN,
      "https://attacker.vercel.app/auth/reset-password",
    ),
    resetUrl(RENEW_PRODUCTION_ORIGIN, "//attacker.vercel.app/auth/reset-password"),
    resetUrl(RENEW_PRODUCTION_ORIGIN, "/dashboard"),
    resetUrl(RENEW_PRODUCTION_ORIGIN, "/auth/reset-password#token-copy"),
    `${RENEW_PRODUCTION_ORIGIN}/api/auth/reset-password/synthetic-token`,
    "not-a-url",
  ])("rejects a hostile or malformed reset URL without echoing it", (url) => {
    let error: unknown
    try {
      validatePasswordResetDeliveryUrl(
        url,
        RENEW_PRODUCTION_ORIGIN,
        "production",
      )
    } catch (caught) {
      error = caught
    }
    expect(error).toEqual(new Error("Password reset URL rejected"))
    expect(String(error)).not.toContain("synthetic-token")
  })

  it("wires the validated URL into delivery before rendering or provider send", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/auth.ts"), "utf8")
    const validation = source.indexOf("validatePasswordResetDeliveryUrl(")
    const provider = source.indexOf("resend.emails.send(")
    expect(validation).toBeGreaterThanOrEqual(0)
    expect(provider).toBeGreaterThan(validation)
    expect(source).toContain("renderPasswordResetEmail(user.name, safeResetUrl)")
    expect(source).not.toMatch(/endsWith\(.*(?:vercel|v0)/)
    expect(source).not.toContain('headers?.get("origin")')
  })
})
