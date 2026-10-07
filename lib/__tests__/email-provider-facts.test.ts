import { describe, expect, it } from "vitest"
import { resolveResendWebhookUpdate } from "@/lib/email/resend-webhook-transition"
describe("provider facts survive out-of-order outcomes", () => {
  it("retains an earlier delivery after a bounce without making the message healthy", () => {
    expect(
      resolveResendWebhookUpdate("bounced", "email.delivered", "2026-10-07T10:00:00Z"),
    ).toEqual({ delivered_at: "2026-10-07T10:00:00Z" })
  })
  it("records open activity even after a later click and keeps click status", () => {
    expect(resolveResendWebhookUpdate("clicked", "email.opened", "2026-10-07T10:01:00Z")).toEqual({
      opened_at: "2026-10-07T10:01:00Z",
    })
  })
})
