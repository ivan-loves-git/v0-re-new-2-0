import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(), requireStaffAccess: vi.fn(), revalidatePath: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(), sendEmail: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({ revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags }))
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }))

import { updateRepreneurOfferStatus } from "@/lib/actions/offers"

function emailClient() {
  return { select: vi.fn((columns: string) => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue(
    columns.includes("first_name")
      ? { data: { first_name: "Ada", last_name: "Test", email: "ada@example.test" }, error: null }
      : { data: { offer: { name: "TEST offer" } }, error: null },
  ) })) })) }
}

describe("offer acceptance and decline replay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.sendEmail.mockResolvedValue({ success: true, resendId: "provider-1" })
  })

  it("uses the one-transaction decision RPC and stable accepted delivery key", async () => {
    const acceptedAt = "2026-08-21T12:00:00.000Z"
    const rpc = vi.fn().mockResolvedValue({
      data: [{ status: "accepted", accepted_at: acceptedAt, expires_at: "2026-09-20T12:00:00.000Z", declined_at: null }], error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn(() => emailClient()) })

    await updateRepreneurOfferStatus("assignment-1", "accepted", "repreneur-1")

    expect(rpc).toHaveBeenCalledWith("transition_repreneur_offer_decision", {
      p_repreneur_offer_id: "assignment-1", p_repreneur_id: "repreneur-1", p_new_status: "accepted",
      p_decline_reason_category: null, p_decline_reason_text: null,
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: `offer-accepted:assignment-1:${acceptedAt}`,
    }))
  })

  it("rejects an opposite stale decision without sending an acceptance email", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null, error: { message: "This offer was already declined. Refresh before changing it again." },
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn() })

    await expect(updateRepreneurOfferStatus("assignment-1", "accepted", "repreneur-1")).rejects.toThrow(
      "This offer was already declined. Refresh before changing it again.",
    )
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("submits a declined decision and its staff reason in the same transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ status: "declined", accepted_at: null, expires_at: null, declined_at: "2026-08-21T12:00:00.000Z" }], error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc, from: vi.fn() })

    await updateRepreneurOfferStatus("assignment-1", "declined", "repreneur-1", "timing_not_right", "  September  ")

    expect(rpc).toHaveBeenCalledWith("transition_repreneur_offer_decision", expect.objectContaining({
      p_new_status: "declined", p_decline_reason_category: "timing_not_right", p_decline_reason_text: "September",
    }))
  })

  it("keeps database decision, lifecycle, replay, and role boundaries together", () => {
    const migration = readFileSync(`${process.cwd()}/scripts/110_atomic_offer_decision.sql`, "utf8")
    expect(migration).toContain("FOR UPDATE OF ro")
    expect(migration).toContain("UPDATE public.repreneur_offers")
    expect(migration).toContain("UPDATE public.repreneurs")
    expect(migration).toContain("v_offer.status::TEXT <> 'offered' AND v_offer.status::TEXT <> p_new_status")
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.transition_repreneur_offer_decision")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.transition_repreneur_offer_decision")
  })
})
