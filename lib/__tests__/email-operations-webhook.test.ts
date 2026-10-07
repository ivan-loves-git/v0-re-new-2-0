import { beforeEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "svix"
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  message: undefined as undefined | { recipient_email: string; cc: string[] },
}))
const secret = "whsec_dGhpcy1pcy1vbmx5LWEtc3ludGhldGljLXNlY3JldA=="
vi.mock("@/lib/env", () => ({
  env: { RESEND_WEBHOOK_SECRET: "whsec_dGhpcy1pcy1vbmx5LWEtc3ludGhldGljLXNlY3JldA==" },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: m.rpc,
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: m.message, error: null }),
      }
      return q
    },
  }),
}))
vi.mock("@/lib/observability/critical-operation", () => ({
  startCriticalOperation: () => ({ success: vi.fn(), failure: vi.fn() }),
}))
import { POST } from "@/app/api/webhooks/resend/route"
function request(
  to: string[],
  type = "email.delivered",
  valid = true,
  mailClass: string | null = "business",
) {
  const payload = JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: "fictional-provider",
      to,
      tags: mailClass ? { renew_mail_class: mailClass } : undefined,
      failed: { reason: "reached_daily_quota" },
    },
  })
  const date = new Date(),
    id = "evt-synthetic"
  const signature = new Webhook(secret).sign(id, date, payload)
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    body: payload,
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": valid ? signature : "v1,forged",
    },
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  m.message = undefined
  m.rpc.mockResolvedValue({ error: null })
})
describe("signed operational event receipt", () => {
  it("requests provider retry until the receipt parent exists, then retains the signed event once", async () => {
    expect((await POST(request(["primary@re-new.invalid"]))).status).toBe(503)
    expect(m.rpc).not.toHaveBeenCalled()
    m.message = { recipient_email: "primary@re-new.invalid", cc: [] }
    expect((await POST(request(["primary@re-new.invalid"]))).status).toBe(200)
    expect(m.rpc).toHaveBeenCalledOnce()
    expect(m.rpc).toHaveBeenCalledWith(
      "email_provider_record_event",
      expect.objectContaining({
        p_id: "evt-synthetic",
        p_recipient_kind: "primary",
        p_recipient: "primary@re-new.invalid",
      }),
    )
  })
  it.each(["access", null])(
    "acknowledges irrelevant %s events without unowned retention or retries",
    async (mailClass) => {
      expect(
        (await POST(request(["primary@re-new.invalid"], "email.delivered", true, mailClass)))
          .status,
      ).toBe(200)
      expect(m.rpc).not.toHaveBeenCalled()
    },
  )
  it("keeps copy bounce separate and records real failed reason", async () => {
    m.message = { recipient_email: "primary@re-new.invalid", cc: ["copy@re-new.invalid"] }
    await POST(request(["copy@re-new.invalid"], "email.bounced"))
    expect(m.rpc).toHaveBeenLastCalledWith(
      "email_provider_record_event",
      expect.objectContaining({ p_recipient_kind: "copy" }),
    )
    await POST(request(["primary@re-new.invalid"], "email.failed"))
    expect(m.rpc).toHaveBeenLastCalledWith(
      "email_provider_record_event",
      expect.objectContaining({ p_recipient_kind: "primary", p_reason: "reached_daily_quota" }),
    )
  })
  it("does not infer a human open actor from the envelope recipient", async () => {
    m.message = { recipient_email: "primary@re-new.invalid", cc: ["copy@re-new.invalid"] }
    await POST(request(["primary@re-new.invalid"], "email.opened"))
    expect(m.rpc).toHaveBeenLastCalledWith(
      "email_provider_record_event",
      expect.objectContaining({ p_recipient_kind: "unknown", p_recipient: null }),
    )
  })
  it("rejects a forged signature before persistence", async () => {
    expect((await POST(request(["primary@re-new.invalid"], "email.clicked", false))).status).toBe(
      401,
    )
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
