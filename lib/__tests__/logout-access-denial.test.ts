import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }))

vi.mock("@/lib/auth", () => ({ auth: { api: { signOut: mocks.signOut } } }))
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))

import { GET } from "@/app/auth/logout/route"

describe("logout access-denial handoff", () => {
  it("forwards only the generic allowlisted access explanation after clearing the session", async () => {
    const response = await GET(new NextRequest("https://app.re-new.team/auth/logout?reason=access_denied"))
    expect(response.headers.get("location")).toBe("https://app.re-new.team/auth/login?reason=access_denied")
  })

  it("does not forward arbitrary logout query data to login", async () => {
    const response = await GET(new NextRequest("https://app.re-new.team/auth/logout?reason=private@example.test&token=secret"))
    expect(response.headers.get("location")).toBe("https://app.re-new.team/auth/login")
  })
})
