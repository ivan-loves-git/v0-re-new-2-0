import { beforeEach, describe, expect, it, vi } from "vitest"

const { capture } = vi.hoisted(() => ({
  capture: {
    config: undefined as
      | undefined
      | { baseURL?: unknown; trustedOrigins?: unknown },
  },
}))

vi.mock("better-auth", () => ({
  betterAuth: (config: { baseURL?: unknown; trustedOrigins?: unknown }) => {
    capture.config = config
    return config
  },
}))

vi.mock("better-auth/next-js", () => ({
  nextCookies: () => ({ id: "next-cookies-test-double" }),
}))

vi.mock("pg", () => ({
  Pool: class TestPool {},
}))

vi.mock("@/lib/email/resend-client", () => ({
  FROM_EMAIL: "noreply@test.invalid",
  FROM_NAME: "Re-New test",
  resend: { emails: { send: vi.fn() } },
}))

vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: vi.fn(),
}))

describe("W-151 Better Auth origin wiring", () => {
  beforeEach(() => {
    capture.config = undefined
    vi.resetModules()
  })

  it("passes a fixed server-owned array rather than a request-dependent callback", async () => {
    await import("@/lib/auth")

    expect(capture.config).toBeDefined()
    expect(capture.config?.baseURL).toBe("http://localhost:3000")
    expect(capture.config?.trustedOrigins).toEqual([
      "https://app.re-new.team",
      "http://localhost:3000",
    ])
    expect(Array.isArray(capture.config?.trustedOrigins)).toBe(true)
  })
})
