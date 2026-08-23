import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  gte: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import { wasEmailSent } from "@/lib/email/send-email"

function queryClient() {
  const limit = vi.fn(async () => ({ data: [{ id: "log-1" }], error: null }))
  mocks.gte.mockImplementation(() => ({ limit }))
  const inFilter = vi.fn(() => ({
    gte: mocks.gte,
    limit,
  }))
  const eqTemplate = vi.fn(() => ({ in: inFilter }))
  const eqRepreneur = vi.fn(() => ({ eq: eqTemplate }))
  const select = vi.fn(() => ({ eq: eqRepreneur }))
  const from = vi.fn(() => ({ select }))

  mocks.createAdminClient.mockReturnValue({ from })

  return { from, inFilter, limit }
}

describe("wasEmailSent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("applies the cutoff when a time window is provided", async () => {
    const { inFilter } = queryClient()
    const before = Date.now()

    await expect(wasEmailSent("rep-1", "abandoned_reminder", 24 * 60)).resolves.toBe(true)

    const cutoff = mocks.gte.mock.calls[0]?.[1]
    expect(mocks.gte).toHaveBeenCalledWith("sent_at", expect.any(String))
    expect(new Date(cutoff).getTime()).toBeLessThanOrEqual(before)
    expect(new Date(cutoff).getTime()).toBeGreaterThan(before - 24 * 60 * 60 * 1000 - 5_000)
    expect(inFilter).toHaveBeenCalledWith("status", ["sent", "delivered", "opened", "clicked"])
  })

  it("checks the full history when no time window is provided", async () => {
    queryClient()

    await expect(wasEmailSent("rep-1", "booking_reminder")).resolves.toBe(true)
    expect(mocks.gte).not.toHaveBeenCalled()
  })
})
