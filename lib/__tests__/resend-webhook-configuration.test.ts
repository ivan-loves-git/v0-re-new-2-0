import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  startCriticalOperation: vi.fn(() => ({ failure: vi.fn(), success: vi.fn() })),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: mocks.startCriticalOperation,
}))

describe("Resend webhook configuration boundary", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("fails closed before parsing or accessing persistence when the signing secret is absent", async () => {
    vi.doMock("@/lib/env", () => ({ env: {} }))
    const { POST } = await import("@/app/api/webhooks/resend/route")

    const response = await POST(
      new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        body: "not parsed",
      }),
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Webhook not configured" })
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
