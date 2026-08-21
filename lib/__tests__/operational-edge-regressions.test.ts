import { describe, expect, it } from "vitest"
import { resolveResendWebhookUpdate } from "@/lib/email/resend-webhook-transition"
import { validateWaitlistRequest } from "@/lib/waitlist-input"
import { offerLifecycleRollback } from "@/lib/offer-lifecycle-rollback"

describe("operational edge regressions", () => {
  it("does not let a late delivered event overwrite a complaint or bounce", () => {
    expect(resolveResendWebhookUpdate("complained", "email.delivered", "2026-08-21T12:00:00.000Z")).toBeNull()
    expect(resolveResendWebhookUpdate("bounced", "email.opened", "2026-08-21T12:00:00.000Z")).toBeNull()
  })

  it("keeps normal delivery evidence monotonic across duplicate and late provider events", () => {
    expect(resolveResendWebhookUpdate("clicked", "email.opened", "2026-08-21T12:00:00.000Z")).toBeNull()
    expect(resolveResendWebhookUpdate("opened", "email.delivered", "2026-08-21T12:00:00.000Z")).toBeNull()
    expect(resolveResendWebhookUpdate("delivered", "email.delivered", "2026-08-21T12:00:00.000Z")).toBeNull()
    expect(resolveResendWebhookUpdate("sent", "email.clicked", "2026-08-21T12:00:00.000Z")).toEqual({
      status: "clicked",
      clicked_at: "2026-08-21T12:00:00.000Z",
    })
  })

  it("records a bounce without writing a column the email_logs schema does not have", () => {
    expect(resolveResendWebhookUpdate("sent", "email.bounced", "2026-08-21T12:00:00.000Z")).toEqual({ status: "bounced" })
  })

  it("rejects forged public waitlist values before persistence", () => {
    expect(validateWaitlistRequest("", "not-an-email", "staff" as never).success).toBe(false)
    expect(validateWaitlistRequest("x".repeat(201), "person@example.test", "seller").success).toBe(false)
  })

  it("normalizes a valid request exactly once", () => {
    expect(validateWaitlistRequest("  Zoë Test  ", "  ZOE@EXAMPLE.TEST ", "repreneur")).toEqual({
      success: true,
      data: { name: "Zoë Test", email: "zoe@example.test", role: "repreneur" },
    })
  })

  it("restores all offer transition fields when the linked lifecycle update fails", () => {
    expect(offerLifecycleRollback({
      status: "offered",
      accepted_at: null,
      expires_at: null,
      declined_at: null,
    })).toEqual({
      status: "offered",
      accepted_at: null,
      expires_at: null,
      declined_at: null,
    })
  })
})
