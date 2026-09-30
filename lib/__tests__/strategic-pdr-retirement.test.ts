import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"

describe("retired Strategic PDR HTTP boundary", () => {
  it.each([
    "/strategic-pdr",
    "/strategic-pdr?card=W-001",
    "/strategic-pdr/requests",
    "/strategic-pdr/requests/11111111-1111-4111-8111-111111111111",
    "/strategic-pdr/work-cards/11111111-1111-4111-8111-111111111111",
    "/api/strategic-pdr/attachments/11111111-1111-4111-8111-111111111111",
  ])("returns the same non-sensitive 404 at %s with or without a session", async (path) => {
    for (const authenticated of [false, true]) {
      const request = new NextRequest(`https://app.re-new.team${path}`, authenticated
        ? { headers: { cookie: "better-auth.session_token=synthetic" } }
        : undefined)
      const response = await proxy(request)
      expect(response.status).toBe(404)
      expect(response.headers.get("location")).toBeNull()
      expect(response.headers.get("cache-control")).toContain("no-store")
      expect(await response.text()).toBe("Not found")
    }
  })

  it("preserves unrelated WAVE route behavior", async () => {
    const response = await proxy(new NextRequest("https://app.re-new.team/guide/roadmap"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/auth/login")
  })

  it("rejects a retired submission before any action can run", async () => {
    const response = await proxy(new NextRequest("https://app.re-new.team/strategic-pdr/requests", {
      method: "POST",
      body: "title=synthetic",
      headers: { cookie: "better-auth.session_token=synthetic", "content-type": "application/x-www-form-urlencoded" },
    }))
    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not found")
  })
})
