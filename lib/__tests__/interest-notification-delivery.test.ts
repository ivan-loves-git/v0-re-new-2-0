import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
  sendEmailDirect: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/email/send-email", () => ({
  sendEmail: mocks.sendEmail,
  sendEmailDirect: mocks.sendEmailDirect,
}))
vi.mock("@/lib/env", () => ({ env: { RENEW_STAFF_NOTIFICATION_EMAIL: "configured-staff@example.test" } }))

import { deliverInterestNotification, renderInterestNotificationCopy } from "@/lib/email/interest-notification-delivery"

const eventId = "76000000-0000-4000-8000-000000000091"
const leaseToken = "76000000-0000-4000-8000-000000000092"
const staffPayload = {
  eventId,
  eventType: "proposed_interested",
  matchId: "76000000-0000-4000-8000-000000000093",
  repreneurId: "76000000-0000-4000-8000-000000000094",
  recipientEmail: "",
  firstName: "Sophie",
  repreneurName: "Sophie Martin",
  opportunityTitle: "Synthetic title",
  templateKey: "proposed_opportunity_response_staff",
  subject: "New response — {opportunityTitle}",
  body: "{repreneurName} answered {responseLabel}.",
}

function fakeDelivery(options?: {
  payload?: unknown
  payloadError?: boolean
  completeResult?: string
  claimStatus?: string
}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "w173_claim_interest_delivery") {
      return { data: options?.claimStatus ? { status: options.claimStatus }
        : { status: "claimed", leaseToken }, error: null }
    }
    if (name === "w173_interest_delivery_payload") {
      return { data: options?.payload === undefined ? staffPayload : options.payload,
        error: options?.payloadError ? { message: "synthetic read failure" } : null }
    }
    if (name === "w173_begin_interest_provider_attempt") return { data: true, error: null }
    if (name === "w173_complete_interest_delivery") {
      return { data: options?.completeResult ?? "suppressed", error: null }
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
  mocks.createAdminClient.mockReturnValue({ rpc })
  return rpc
}

describe("exact-interest notification adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does not replay an event suppressed when its key was inactive", async () => {
    const rpc = fakeDelivery({ claimStatus: "suppressed" })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })

  it("uses only the configured staff destination, never the client's mailbox", async () => {
    const rpc = fakeDelivery({ completeResult: "sent" })
    mocks.sendEmailDirect.mockImplementation(async ({ to, beforeProviderAttempt }) => {
      expect(to).toBe("configured-staff@example.test")
      expect(await beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "provider-1", providerOutcome: "accepted" }
    })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("sent")
    expect(rpc).toHaveBeenCalledWith("w173_begin_interest_provider_attempt", expect.objectContaining({
      p_event_id: eventId,
      p_expected_payload: staffPayload,
    }))
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("turns a blocked staff recipient into terminal suppression before begin", async () => {
    const rpc = fakeDelivery()
    mocks.sendEmailDirect.mockResolvedValue({ success: false, providerOutcome: "blocked" })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("suppressed")
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w173_begin_interest_provider_attempt")
    expect(rpc).toHaveBeenCalledWith("w173_complete_interest_delivery", expect.objectContaining({
      p_outcome: "suppressed",
    }))
  })

  it("reports canonical review_required after a prior unknown send meets a block", async () => {
    fakeDelivery({ completeResult: "review_required" })
    mocks.sendEmailDirect.mockResolvedValue({ success: false, providerOutcome: "blocked" })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("review_required")
  })

  it("does not turn a transient payload read error into terminal suppression", async () => {
    const rpc = fakeDelivery({ payloadError: true })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("failed")
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("w173_complete_interest_delivery")
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })

  it("honors review_required even on the early invalid-payload path", async () => {
    fakeDelivery({ payload: null, completeResult: "review_required" })
    await expect(deliverInterestNotification(eventId)).resolves.toBe("review_required")
    expect(mocks.sendEmailDirect).not.toHaveBeenCalled()
  })

  it("cannot interpolate a private reason or source variable into copy", () => {
    const copy = renderInterestNotificationCopy({
      ...staffPayload,
      body: "{repreneurName} — {internalReason} — {sourceOffice}",
    } as never)
    expect(copy.body).toContain("{internalReason}")
    expect(copy.body).toContain("{sourceOffice}")
    expect(JSON.stringify(copy.variables)).not.toContain("internalReason")
    expect(JSON.stringify(copy.variables)).not.toContain("sourceOffice")
  })
})
