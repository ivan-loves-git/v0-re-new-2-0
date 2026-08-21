import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import { getWaitlistReviewRequests, promoteWaitlistRepreneur } from "@/lib/actions/waitlist-review"

const WAITLIST_ID = "10000000-0000-4000-8000-000000000001"
const REPRENEUR_ID = "20000000-0000-4000-8000-000000000001"

describe("staff access-request promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
  })

  it("keeps concurrency, seller rejection, and exact-once linking inside one transaction", () => {
    const migration = readFileSync(`${process.cwd()}/scripts/109_waitlist_staff_promotion.sql`, "utf8")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toMatch(/role\s*<>\s*'repreneur'/)
    expect(migration).toContain("promoted_repreneur_id")
    expect(migration).toContain("access_request_staff_review")
    expect(migration).toMatch(/IF request_row\.promoted_repreneur_id IS NOT NULL THEN[\s\S]*RETURN/)
  })

  it("links an existing canonical email instead of rejecting or creating another profile", () => {
    const migration = readFileSync(`${process.cwd()}/scripts/109_waitlist_staff_promotion.sql`, "utf8")
    expect(migration).not.toContain("A repreneur profile already uses this email address.")
    expect(migration).toMatch(/SELECT\s+id\s+INTO\s+target_repreneur_id[\s\S]*FROM public\.repreneurs/)
    expect(migration).toMatch(/IF target_repreneur_id IS NULL THEN[\s\S]*INSERT INTO public\.repreneurs/)
  })

  it("does not require creation names when the request links to an existing profile", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: REPRENEUR_ID, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(promoteWaitlistRepreneur(WAITLIST_ID, "", "")).resolves.toEqual({
      ok: true,
      repreneurId: REPRENEUR_ID,
      href: `/repreneurs/${REPRENEUR_ID}`,
    })
    expect(rpc).toHaveBeenCalledWith("promote_waitlist_repreneur", expect.objectContaining({
      p_waitlist_id: WAITLIST_ID,
      p_first_name: "",
      p_last_name: "",
    }))
  })

  it("makes missing names explicit when a new profile must be created", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Both first and last name are required." },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(promoteWaitlistRepreneur(WAITLIST_ID, "", "Test")).resolves.toEqual({
      ok: false,
      message: "Enter both first and last name to create a new Repreneur profile.",
    })
  })

  it("returns the canonical linked profile from the atomic promotion", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: REPRENEUR_ID, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(promoteWaitlistRepreneur(WAITLIST_ID, " Ada ", " Test ")).resolves.toEqual({
      ok: true,
      repreneurId: REPRENEUR_ID,
      href: `/repreneurs/${REPRENEUR_ID}`,
    })
    expect(rpc).toHaveBeenCalledWith("promote_waitlist_repreneur", {
      p_waitlist_id: WAITLIST_ID,
      p_first_name: "Ada",
      p_last_name: "Test",
      p_actor_user_id: "staff-1",
    })
  })

  it("returns the same canonical profile when staff retries promotion", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: REPRENEUR_ID, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    const first = await promoteWaitlistRepreneur(WAITLIST_ID, "Ada", "Test")
    const retry = await promoteWaitlistRepreneur(WAITLIST_ID, "Ada", "Test")

    expect(first).toEqual(retry)
    expect(first).toEqual(expect.objectContaining({ ok: true, repreneurId: REPRENEUR_ID }))
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it.each(["", "not-a-uuid"])("maps malformed or missing request id %j to a friendly result", async (waitlistId) => {
    mocks.createAdminClient.mockReturnValue({ rpc: vi.fn() })

    await expect(promoteWaitlistRepreneur(waitlistId, "Ada", "Test")).resolves.toEqual({
      ok: false,
      message: "This access request could not be found. Refresh the list and try again.",
    })
    expect(mocks.requireStaffAccess).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("maps a deleted request to the same friendly not-found result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Access request was not found." },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(promoteWaitlistRepreneur(WAITLIST_ID, "Ada", "Test")).resolves.toEqual({
      ok: false,
      message: "This access request could not be found. Refresh the list and try again.",
    })
  })

  it("searches staff review rows while preserving repreneur and seller labels", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: "1", name: "TEST Ada", email: "ada@example.test", role: "repreneur", status: "pending", created_at: "2026-08-21T09:00:00Z", promoted_repreneur_id: null },
        { id: "2", name: "Seller Person", email: "seller@example.test", role: "seller", status: "pending", created_at: "2026-08-21T08:00:00Z", promoted_repreneur_id: null },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ select })) })

    await expect(getWaitlistReviewRequests("test ada")).resolves.toEqual([
      expect.objectContaining({ id: "1", role: "repreneur", name: "TEST Ada" }),
    ])
  })
})
