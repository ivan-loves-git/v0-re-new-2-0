import { describe, expect, it } from "vitest"
import { sanitizeWaveProperties } from "@/lib/telemetry/privacy"

const context = {
  environment: "production" as const,
  release: "1200.abc1234",
  isTest: false,
}

describe("M2 server-confirmed telemetry payloads", () => {
  it("keeps portal lifecycle events metadata-only", () => {
    const properties = sanitizeWaveProperties({
      role: "repreneur",
      surface: "repreneur",
      workflow: "portal_pursuit",
      action: "upload",
      outcome: "success",
      error_code: "upload_failed",
      route_template: "/portal/deals/019fd674-9442-7000-a255-fa06c75772d7",
      // These must never survive, even if a future caller accidentally adds them.
      email: "person@example.com",
      opportunity_id: "019fd674-9442-7000-a255-fa06c75772d7",
      document_name: "Private IM.pdf",
      note: "private note",
    } as never, context)

    expect(properties).toMatchObject({
      role: "repreneur",
      surface: "repreneur",
      workflow: "portal_pursuit",
      action: "upload",
      outcome: "success",
      error_code: "upload_failed",
      route_template: "/portal/deals/:matchId",
    })
    expect(properties).not.toHaveProperty("email")
    expect(properties).not.toHaveProperty("opportunity_id")
    expect(properties).not.toHaveProperty("document_name")
    expect(properties).not.toHaveProperty("note")
  })
})
