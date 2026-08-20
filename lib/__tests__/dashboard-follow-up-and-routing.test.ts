import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  queueWaveServerEvent: vi.fn(),
}))

vi.mock("@/lib/access-control", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access-control")>()),
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("@/lib/telemetry/server", () => ({
  queueWaveServerEvent: mocks.queueWaveServerEvent,
}))

import { getFollowUpSuggestions } from "@/lib/actions/wave-ai"
import { postLoginDestinationForAccess } from "@/lib/access-control"

describe("dashboard follow-up and post-login access behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"))
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-001" } })
  })

  it("loads deterministic stale-contact suggestions through one set-based RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: "r-old", first_name: "Old", last_name: "Contact", email: "old@example.com",
        journey_stage: "qualified", days_since_contact: 31, total_count: 1,
      }],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(getFollowUpSuggestions()).resolves.toEqual({
      suggestions: [{
        id: "r-old",
        firstName: "Old",
        lastName: "Contact",
        email: "old@example.com",
        journeyStage: "qualified",
        daysSinceContact: 31,
      }],
      totalCount: 1,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("get_follow_up_suggestions", {
      p_now: "2026-08-20T12:00:00.000Z",
    })
  })

  it("preserves the database total while returning only its already ordered top ten rows", async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      id: `r-${index + 1}`,
      first_name: `First ${index + 1}`,
      last_name: "Contact",
      email: `contact-${index + 1}@example.com`,
      journey_stage: "qualified",
      days_since_contact: 40 - index,
      total_count: 12,
    }))
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: rows, error: null }) })

    await expect(getFollowUpSuggestions()).resolves.toEqual({
      suggestions: rows.map((row) => ({
        id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email,
        journeyStage: row.journey_stage, daysSinceContact: row.days_since_contact,
      })),
      totalCount: 12,
    })
  })

  it("keeps a valid but unassigned account denied while carrying a generic explanation through logout", () => {
    expect(postLoginDestinationForAccess({
      role: "unassigned",
      repreneurId: null,
      repreneurName: null,
      user: { id: "user-001" } as never,
    })).toBe("/auth/logout?reason=access_denied")
  })

  it("continues clearing a missing or revoked session without calling it an access denial", () => {
    expect(postLoginDestinationForAccess(null)).toBe("/auth/logout")
  })

  it("records a failed follow-up read using only allowlisted staff metadata", async () => {
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { message: "private database failure for person@example.test" },
    }) })
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(getFollowUpSuggestions()).resolves.toEqual({
      suggestions: [], totalCount: 0,
    })
    expect(mocks.queueWaveServerEvent).toHaveBeenCalledWith({
      distinctId: "staff-001",
      event: "wave_action_failed",
      properties: expect.objectContaining({
        surface: "staff", role: "staff", workflow: "repreneur_management",
        action: "render", outcome: "failure", error_code: "unavailable",
      }),
    })
    expect(JSON.stringify(mocks.queueWaveServerEvent.mock.calls)).not.toContain("person@example.test")
    error.mockRestore()
  })
})
