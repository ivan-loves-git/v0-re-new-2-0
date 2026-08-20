import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  requirePortalAccess: vi.fn(),
  createAdminClient: vi.fn(),
  queueM2StaffPursuitEvent: vi.fn(),
  queueM2RepreneurEvent: vi.fn(),
  triggerOpportunityMemoNotification: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
  requirePortalAccess: mocks.requirePortalAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock("@/lib/telemetry/m2-repreneur", () => ({
  queueM2StaffPursuitEvent: mocks.queueM2StaffPursuitEvent,
  queueM2RepreneurEvent: mocks.queueM2RepreneurEvent,
}))
vi.mock("@/lib/trigger-opportunity-memo-notification", () => ({
  triggerOpportunityMemoNotification: mocks.triggerOpportunityMemoNotification,
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  runOpportunityPursuitJourneyAction,
  startOpportunityPursuit,
} from "@/lib/actions/opportunity-pursuit-journey"
import { submitPortalPursuitSignedNda } from "@/lib/actions/portal-pursuit-nda"

function emittedEvents() {
  return [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]
    .map(([entry]) => JSON.parse(String(entry))) as Array<
    Record<string, unknown>
  >
}

describe("critical server action traces", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.requireStaffAccess.mockResolvedValue({
      user: { id: "staff-private-1", email: "staff@example.test" },
    })
    mocks.requirePortalAccess.mockResolvedValue({
      user: { id: "user-private-1", email: "owner@example.test" },
      repreneurId: "repreneur-private-1",
    })
  })

  it("preserves a successful pursuit action while tracing no business ids", async () => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: "event-private-1", error: null }),
    })

    const result = await runOpportunityPursuitJourneyAction({
      matchId: "match-private-1",
      action: "qualify",
      reason: "private staff reason",
    })

    expect(result).toEqual({
      success: true,
      message: "Pursuit evidence recorded.",
      eventId: "event-private-1",
    })
    expect(emittedEvents().map((event) => event.stage)).toEqual([
      "start",
      "success",
    ])
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    for (const privateValue of [
      "match-private-1",
      "event-private-1",
      "private staff reason",
      "staff-private-1",
      "staff@example.test",
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it("preserves a pursuit persistence error while tracing only its category", async () => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error(
          "raw database failure for match-private-1 owner@example.test",
        ),
      }),
    })

    const result = await runOpportunityPursuitJourneyAction({
      matchId: "match-private-1",
      action: "qualify",
    })

    expect(result).toEqual({
      success: false,
      message: "raw database failure for match-private-1 owner@example.test",
    })
    expect(emittedEvents()[1]).toMatchObject({
      operation: "pursuit.journey_action",
      stage: "failure",
      error_category: "persistence_failed",
    })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("raw database failure")
    expect(serialized).not.toContain("match-private-1")
    expect(serialized).not.toContain("owner@example.test")
  })

  it("returns the business validation message from a plain PostgREST error object", async () => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message:
            "Validation requires the exact current signed copy uploaded after current Gate 1.",
        },
      }),
    })

    await expect(
      runOpportunityPursuitJourneyAction({
        matchId: "match-private-1",
        action: "validate_renew_copy",
        artifactId: "artifact-private-1",
      }),
    ).resolves.toEqual({
      success: false,
      message:
        "Validation requires the exact current signed copy uploaded after current Gate 1.",
    })
  })

  it.each([
    "connection refused by internal database host",
    "Validation requires the exact current signed copy uploaded after current Gate 1.\ninternal detail",
    "x".repeat(300),
  ])("does not expose an untrusted plain-object error message: %s", async (message) => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }),
    })

    await expect(
      runOpportunityPursuitJourneyAction({
        matchId: "match-private-1",
        action: "validate_renew_copy",
        artifactId: "artifact-private-1",
      }),
    ).resolves.toEqual({
      success: false,
      message: "Could not record pursuit evidence.",
    })
  })

  it("keeps the generic fallback for an error with no readable message", async () => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "XX000" } }),
    })

    await expect(
      runOpportunityPursuitJourneyAction({
        matchId: "match-private-1",
        action: "qualify",
      }),
    ).resolves.toEqual({
      success: false,
      message: "Could not record pursuit evidence.",
    })
  })

  it("closes a pursuit-start trace when the database call rejects", async () => {
    const rawError = new Error(
      "transport failed for match-private-1 staff@example.test",
    )
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockRejectedValue(rawError),
    })

    await expect(
      startOpportunityPursuit("match-private-1"),
    ).rejects.toBe(rawError)

    const events = emittedEvents().filter(
      (event) => event.operation === "pursuit.start",
    )
    expect(events.map((event) => event.stage)).toEqual(["start", "failure"])
    expect(events[1]).toMatchObject({ error_category: "persistence_failed" })
    expect(JSON.stringify(events)).not.toContain("match-private-1")
    expect(JSON.stringify(events)).not.toContain("staff@example.test")
  })

  it("traces a signed-NDA validation failure without reading form values", async () => {
    const formData = new FormData()
    formData.set("match_id", "match-private-1")
    formData.set("title", "Private NDA title")

    const result = await submitPortalPursuitSignedNda(formData)

    expect(result).toEqual({
      success: false,
      message: "Choose your signed NDA PDF.",
    })
    expect(emittedEvents()[1]).toMatchObject({
      operation: "pursuit.signed_nda_upload",
      stage: "failure",
      error_category: "validation_failed",
    })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    expect(serialized).not.toContain("match-private-1")
    expect(serialized).not.toContain("Private NDA title")
    expect(serialized).not.toContain("repreneur-private-1")
  })

  it("preserves the idempotent signed-NDA success path with a safe trace", async () => {
    const matchMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "match-private-1",
        opportunity_id: "opportunity-private-1",
        repreneur_id: "repreneur-private-1",
        status: "active_pursuit",
      },
      error: null,
    })
    const artifactMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: "artifact-private-1", version_number: 2 },
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table === "opportunity_matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: matchMaybeSingle })),
          })),
        }
      }
      if (table === "opportunity_nda_artifacts") {
        const thirdEq = vi.fn(() => ({ maybeSingle: artifactMaybeSingle }))
        const secondEq = vi.fn(() => ({ eq: thirdEq }))
        const firstEq = vi.fn(() => ({ eq: secondEq }))
        return { select: vi.fn(() => ({ eq: firstEq })) }
      }
      throw new Error(`Unexpected table ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({
      from,
      rpc: vi.fn().mockResolvedValue({ data: "gate-private-1", error: null }),
    })
    const formData = new FormData()
    formData.set("match_id", "match-private-1")
    formData.set(
      "file",
      new File(["private PDF bytes"], "private-signed-nda.pdf", {
        type: "application/pdf",
      }),
    )

    const result = await submitPortalPursuitSignedNda(formData)

    expect(result).toEqual({
      success: true,
      message:
        "Your signed NDA has already been received for staff validation.",
      artifactId: "artifact-private-1",
      versionNumber: 2,
    })
    expect(emittedEvents()[1]).toMatchObject({
      operation: "pursuit.signed_nda_upload",
      stage: "success",
    })
    const serialized = vi
      .mocked(console.info).mock.calls
      .concat(vi.mocked(console.error).mock.calls)
      .map(([entry]) => String(entry))
      .join("\n")
    for (const privateValue of [
      "match-private-1",
      "opportunity-private-1",
      "repreneur-private-1",
      "artifact-private-1",
      "private-signed-nda.pdf",
      "private PDF bytes",
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it("closes a signed-NDA trace when its match lookup rejects", async () => {
    const rawError = new Error(
      "lookup exploded for match-private-1 owner@example.test",
    )
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockRejectedValue(rawError),
          })),
        })),
      })),
    })
    const formData = new FormData()
    formData.set("match_id", "match-private-1")
    formData.set(
      "file",
      new File(["private PDF bytes"], "private-signed-nda.pdf", {
        type: "application/pdf",
      }),
    )

    await expect(submitPortalPursuitSignedNda(formData)).rejects.toBe(rawError)

    const events = emittedEvents().filter(
      (event) => event.operation === "pursuit.signed_nda_upload",
    )
    expect(events.map((event) => event.stage)).toEqual(["start", "failure"])
    expect(events[1]).toMatchObject({ error_category: "internal_error" })
    const serialized = JSON.stringify(events)
    expect(serialized).not.toContain("match-private-1")
    expect(serialized).not.toContain("owner@example.test")
    expect(serialized).not.toContain("private-signed-nda.pdf")
  })
})
