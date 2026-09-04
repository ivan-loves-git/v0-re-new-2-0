import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
  consumeRequestRateLimit: vi.fn(),
  requestFingerprint: vi.fn(),
  withPasswordResetAuthority: vi.fn(),
}))

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({
    GET: mocks.authGet,
    POST: mocks.authPost,
  }),
}))

vi.mock("@/lib/auth", () => ({ auth: {} }))

vi.mock("@/lib/security/intake-upload", () => ({
  consumeRequestRateLimit: mocks.consumeRequestRateLimit,
  requestFingerprint: mocks.requestFingerprint,
}))

vi.mock("@/lib/password-reset-link", () => ({
  withPasswordResetAuthority: mocks.withPasswordResetAuthority,
}))

import { GET, POST } from "@/app/api/auth/[...all]/route"

const token = "aB3dE5gH7jK9mN2pQ4sT6vX8"

function resetRequest() {
  return new Request("https://app.re-new.team/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword: "safe-password" }),
  })
}

describe("password reset API authority", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeRequestRateLimit.mockResolvedValue({
      allowed: true,
      retryAfter: 900,
    })
    mocks.requestFingerprint.mockReturnValue("test-fingerprint")
    mocks.authGet.mockResolvedValue(new Response(null, { status: 204 }))
    mocks.authPost.mockResolvedValue(Response.json({ status: true }))
  })

  it("invokes Better Auth only inside the current-role reset guard", async () => {
    mocks.withPasswordResetAuthority.mockImplementation(
      async (_token: string, action: () => Promise<Response>) => ({
        authorized: true,
        result: await action(),
      }),
    )

    const response = await POST(resetRequest())

    expect(response.status).toBe(200)
    expect(mocks.withPasswordResetAuthority).toHaveBeenCalledWith(
      token,
      expect.any(Function),
    )
    expect(mocks.authPost).toHaveBeenCalledTimes(1)
  })

  it("returns the native privacy-safe invalid-token shape when access is revoked", async () => {
    mocks.withPasswordResetAuthority.mockResolvedValue({ authorized: false })

    const response = await POST(resetRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_TOKEN",
      message: "Invalid token",
    })
    expect(mocks.authPost).not.toHaveBeenCalled()
  })

  it("fails closed without exposing authority or database detail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.withPasswordResetAuthority.mockRejectedValue(
      new Error("private database detail"),
    )

    const response = await POST(resetRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      code: "RESET_AUTHORITY_UNAVAILABLE",
      message: "Password reset is temporarily unavailable.",
    })
    expect(errorSpy).toHaveBeenCalledWith(
      "Password reset authority was unavailable.",
    )
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(
      "private database detail",
    )
    expect(mocks.authPost).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it("protects the raw-token callback redirect before the browser reaches the form", async () => {
    mocks.authGet.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          Location: `/auth/reset-password?token=${token}&intent=portal`,
        },
      }),
    )

    const response = await GET(
      new Request(
        `https://app.re-new.team/api/auth/reset-password/${token}?callbackURL=%2Fauth%2Freset-password%3Fintent%3Dportal`,
      ),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toContain(token)
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    )
    expect(response.headers.get("Pragma")).toBe("no-cache")
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
    expect(response.headers.get("X-Robots-Tag")).toBe(
      "noindex, nofollow, noarchive",
    )
  })

  it("does not add reset-token headers to unrelated Better Auth GETs", async () => {
    const response = await GET(
      new Request("https://app.re-new.team/api/auth/get-session"),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("Cache-Control")).toBeNull()
    expect(response.headers.get("Referrer-Policy")).toBeNull()
  })

  it("applies the strict request-reset rate limit to Better Auth's actual path", async () => {
    const request = new Request(
      "https://app.re-new.team/api/auth/request-password-reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "synthetic@example.invalid",
          redirectTo: "/auth/reset-password",
        }),
      },
    )

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.consumeRequestRateLimit).toHaveBeenCalledWith(
      "auth:/api/auth/request-password-reset:test-fingerprint",
      3,
      900,
    )
    expect(mocks.authPost).toHaveBeenCalledTimes(1)
  })
})
