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

function followUpClient() {
  const repreneurs = [
    { id: "r-old", first_name: "Old", last_name: "Contact", email: "old@example.com", journey_stage: "qualified", updated_at: "2026-07-01T00:00:00.000Z" },
    { id: "r-recent", first_name: "Recent", last_name: "Contact", email: "recent@example.com", journey_stage: "lead", updated_at: "2026-07-01T00:00:00.000Z" },
    { id: "r-updated", first_name: "Updated", last_name: "Record", email: "updated@example.com", journey_stage: "client", updated_at: "2026-08-19T00:00:00.000Z" },
  ]
  const notes = [
    { repreneur_id: "r-old", created_at: "2026-07-15T00:00:00.000Z" },
    { repreneur_id: "r-recent", created_at: "2026-08-19T00:00:00.000Z" },
  ]
  const activities = [
    { repreneur_id: "r-old", created_at: "2026-07-20T00:00:00.000Z" },
  ]
  const from = vi.fn((table: string) => {
    const rows = table === "repreneurs" ? repreneurs : table === "notes" ? notes : activities
    const result = { data: rows, error: null }
    const terminal = vi.fn().mockResolvedValue(result)
    const ordered = { order: terminal }
    const filtered = {
      in: vi.fn(() => ordered),
    }
    return {
      select: vi.fn(() => ({
        is: vi.fn(() => ({ not: vi.fn(() => ({ order: terminal })) })),
        in: filtered.in,
      })),
    }
  })
  return { from }
}

describe("dashboard follow-up and post-login access behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"))
    mocks.requireStaffAccess.mockResolvedValue({ role: "staff", user: { id: "staff-001" } })
  })

  it("loads deterministic stale-contact suggestions in three bounded reads, not two reads per repreneur", async () => {
    const { from } = followUpClient()
    mocks.createAdminClient.mockReturnValue({ from })

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
    expect(from).toHaveBeenCalledTimes(3)
    expect(from).toHaveBeenCalledWith("repreneurs")
    expect(from).toHaveBeenCalledWith("notes")
    expect(from).toHaveBeenCalledWith("activities")
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
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            not: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "private database failure for person@example.test" },
              }),
            })),
          })),
        })),
      })),
    })
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
