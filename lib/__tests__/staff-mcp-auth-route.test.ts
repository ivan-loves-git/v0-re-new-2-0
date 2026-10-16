import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
}))

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({ GET: mocks.authGet, POST: mocks.authPost }),
}))
vi.mock("@/lib/auth", () => ({ auth: {} }))
vi.mock("@/lib/security/intake-upload", () => ({
  consumeRequestRateLimit: vi.fn(),
  requestFingerprint: vi.fn(),
}))
vi.mock("@/lib/password-reset-link", () => ({
  validatePasswordResetLink: vi.fn(),
  withPasswordResetAuthority: vi.fn(),
}))

import { GET, POST } from "@/app/api/auth/[...all]/route"

describe("staff Claude connection side door", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authGet.mockResolvedValue(new Response(null, { status: 204 }))
  })

  it("never lets a browser reach the plugin's own authorize step", async () => {
    const response = await GET(
      new Request(
        "https://app.re-new.team/api/auth/mcp/authorize?client_id=a&redirect_uri=http%3A%2F%2Flocalhost%2Fcb&response_type=code",
      ),
    )
    expect(response.status).toBe(404)
    expect(mocks.authGet).not.toHaveBeenCalled()
  })

  it("closes the plugin endpoints WAVE does not use", async () => {
    for (const path of [
      "/api/auth/mcp/get-session",
      "/api/auth/.well-known/oauth-authorization-server",
      "/api/auth/.well-known/oauth-protected-resource",
    ]) {
      expect((await GET(new Request(`https://app.re-new.team${path}`))).status).toBe(404)
    }
    const consent = await POST(
      new Request("https://app.re-new.team/api/auth/oauth2/consent", { method: "POST", body: "{}" }),
    )
    expect(consent.status).toBe(404)
    expect(mocks.authGet).not.toHaveBeenCalled()
    expect(mocks.authPost).not.toHaveBeenCalled()
  })

  it("leaves the other Better Auth reads unchanged", async () => {
    const response = await GET(new Request("https://app.re-new.team/api/auth/get-session"))
    expect(response.status).toBe(204)
    expect(mocks.authGet).toHaveBeenCalledOnce()
  })
})
