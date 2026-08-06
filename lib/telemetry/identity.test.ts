import { describe, expect, it } from "vitest"
import { getOpaqueTelemetryUserId } from "@/lib/telemetry/identity"
import { isOpaqueUuid } from "@/lib/telemetry/privacy"

describe("opaque telemetry identity", () => {
  it("maps authentication IDs to stable analytics-only UUIDs", () => {
    const first = getOpaqueTelemetryUserId("better-auth-user-123")
    const repeated = getOpaqueTelemetryUserId("better-auth-user-123")
    const second = getOpaqueTelemetryUserId("better-auth-user-456")

    expect(isOpaqueUuid(first)).toBe(true)
    expect(first).toBe(repeated)
    expect(second).not.toBe(first)
    expect(first).not.toContain("better-auth-user")
  })

  it("rejects an empty source identity", () => {
    expect(() => getOpaqueTelemetryUserId("   ")).toThrow(
      "Telemetry identity requires a user ID.",
    )
  })
})
