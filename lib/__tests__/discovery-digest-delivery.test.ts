import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ db: vi.fn(), sendEmail: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.db }))
vi.mock("@/lib/email/send-email", () => ({ sendEmail: m.sendEmail }))

import { deliverDiscoveryDigest, runDueDiscoveryDigests } from "@/lib/email/discovery-digest-delivery"
import { render } from "@react-email/render"

const deliveryId = "13600000-0000-4000-8000-000000000101"
const leaseToken = "13600000-0000-4000-8000-000000000102"
const payload = {
  recipientEmail: "fictional-buyer@example.test",
  firstName: "Sophie",
  subject: "De nouvelles opportunités à découvrir",
  items: [{
    opportunityId: "13600000-0000-4000-8000-000000000103",
    publicTitle: "Fictional public workshop",
    teaserSummary: "A deliberately fictional public teaser.",
  }],
}

function fakeDelivery(options: { status?: string; payload?: unknown; begin?: boolean; logOutcome?: string | null; completeError?: boolean } = {}) {
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (name === "d136_claim") return { data: options.status
      ? { status: options.status } : {
          status: "claimed", leaseToken, payload: options.payload === undefined ? payload : options.payload,
          payloadSha256: "a".repeat(64), repreneurId: "13600000-0000-4000-8000-000000000104",
        }, error: null }
    if (name === "d136_begin_provider_attempt") return { data: options.begin ?? true, error: null }
    if (name === "d136_complete") {
      if (options.completeError) return { data: null, error: { message: "synthetic lost finalizer" } }
      return { data: ({ accepted: "sent", rejected: "failed", uncertain: "review_required",
        deferred: "pending", blocked: "suppressed" } as Record<string, string>)[String(args?.p_outcome)], error: null }
    }
    throw new Error(`Unexpected RPC ${name}`)
  })
  const maybeSingle = vi.fn().mockResolvedValue({ data: { provider_outcome: options.logOutcome ?? null }, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  m.db.mockReturnValue({ rpc, from: vi.fn().mockReturnValue({ select }) })
  return rpc
}

describe("future discovery digest delivery", () => {
  beforeEach(() => vi.clearAllMocks())

  it("does no provider work for an OFF, suppressed or already claimed delivery", async () => {
    const rpc = fakeDelivery({ status: "suppressed" })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledOnce()
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it("keeps a lost response uncertain before the 23-hour manual-review fence", async () => {
    const rpc = fakeDelivery({ status: "uncertain" })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("uncertain")
    expect(rpc).toHaveBeenCalledOnce()
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it("binds the approved frozen public payload, one provider key and authoritative receipt", async () => {
    const rpc = fakeDelivery()
    m.sendEmail.mockImplementation(async (params) => {
      expect(params.to).toBe(payload.recipientEmail)
      expect(params.templateKey).toBe("opportunity_discovery_digest")
      expect(params.idempotencyKey).toBe(`discovery-digest:${deliveryId}`)
      const html = await render(params.react)
      expect(html).toContain(payload.items[0].publicTitle)
      expect(html).toContain(payload.items[0].teaserSummary)
      expect(html).not.toContain(payload.items[0].opportunityId)
      expect(html).not.toContain("source_office")
      expect(await params.beforeProviderAttempt()).toBe(true)
      return { success: true, resendId: "fictional-receipt" }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("sent")
    expect(rpc).toHaveBeenCalledWith("d136_begin_provider_attempt", {
      p_delivery_id: deliveryId, p_lease_token: leaseToken,
      p_payload_sha256: "a".repeat(64), p_expected_payload: payload,
    })
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({
      p_outcome: "accepted", p_provider_message_id: "fictional-receipt",
    }))
  })

  it("suppresses a withdrawn current gate before provider I/O", async () => {
    const rpc = fakeDelivery({ begin: false })
    m.sendEmail.mockImplementation(async ({ beforeProviderAttempt }) => {
      expect(await beforeProviderAttempt()).toBe(false)
      return { success: false, providerOutcome: "fenced" }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "blocked" }))
  })

  it("defers only a proven pre-I/O limit, retaining the same delivery", async () => {
    const rpc = fakeDelivery()
    m.sendEmail.mockResolvedValue({ success: false, providerOutcome: "deferred" })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("pending")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "deferred" }))
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("d136_begin_provider_attempt")
  })

  it("preserves unknown outcome after begin, even when the email adapter says deferred", async () => {
    const rpc = fakeDelivery()
    m.sendEmail.mockImplementation(async ({ beforeProviderAttempt }) => {
      await beforeProviderAttempt()
      return { success: false, providerOutcome: "deferred" }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("review_required")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "uncertain" }))
  })

  it("never reports sent without an authoritative provider receipt", async () => {
    const rpc = fakeDelivery()
    m.sendEmail.mockImplementation(async ({ beforeProviderAttempt }) => {
      await beforeProviderAttempt()
      return { success: true }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("review_required")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "uncertain" }))
  })

  it("retries only a conclusive provider rejection with the same operation key", async () => {
    const rpc = fakeDelivery({ logOutcome: "rejected" })
    m.sendEmail.mockImplementation(async ({ beforeProviderAttempt }) => {
      await beforeProviderAttempt()
      return { success: false }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("failed")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "rejected" }))
  })

  it("rejects malformed frozen content before a provider call", async () => {
    const rpc = fakeDelivery({ payload: { ...payload, items: [{ ...payload.items[0], teaserSummary: "" }] } })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("suppressed")
    expect(rpc).toHaveBeenCalledWith("d136_complete", expect.objectContaining({ p_outcome: "blocked" }))
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it("does not claim acceptance when finalization was lost", async () => {
    fakeDelivery({ completeError: true })
    m.sendEmail.mockImplementation(async ({ beforeProviderAttempt }) => {
      await beforeProviderAttempt()
      return { success: true, resendId: "fictional-receipt" }
    })
    await expect(deliverDiscoveryDigest(deliveryId)).resolves.toBe("failed")
  })

  it("leaves OFF windows and recipient queue empty without provider I/O", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "off" }, error: null })
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [], error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    }
    const review = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count: 0, error: null }) }
    const from = vi.fn().mockImplementation((table: string) => table === "discovery_digest_deliveries"
      ? (from.mock.calls.length === 4 ? review : query) : query)
    m.db.mockReturnValue({ rpc, from })
    const result = await runDueDiscoveryDigests()
    expect(result).toMatchObject({ materialized: 0, processed: 0, sent: 0, reviewRequired: 0 })
    expect(m.sendEmail).not.toHaveBeenCalled()
  })
})
