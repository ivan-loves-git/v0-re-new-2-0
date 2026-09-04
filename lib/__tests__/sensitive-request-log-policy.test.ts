import { describe, expect, it } from "vitest"
import { sensitiveRequestLogPatterns } from "@/lib/sensitive-request-log-policy.mjs"

function isSuppressed(url: string) {
  return sensitiveRequestLogPatterns.some((pattern) => pattern.test(url))
}

describe("sensitive request logging policy", () => {
  it.each([
    "/auth/reset-password?token=TOKEN_VALUE",
    "/auth/reset-password?token=TOKEN_VALUE&intent=portal",
    "/api/auth/reset-password/TOKEN_VALUE?callbackURL=%2Fauth%2Freset-password",
    "/api/auth/reset-password",
  ])("suppresses token-bearing reset traffic at %s", (url) => {
    expect(isSuppressed(url)).toBe(true)
  })

  it.each([
    "/auth/forgot-password",
    "/api/auth/request-password-reset",
    "/portal/deals",
  ])("keeps ordinary request logging at %s", (url) => {
    expect(isSuppressed(url)).toBe(false)
  })
})
