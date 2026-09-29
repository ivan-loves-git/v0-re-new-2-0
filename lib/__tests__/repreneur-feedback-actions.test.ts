import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  portal: vi.fn(), staff: vi.fn(), client: vi.fn(), from: vi.fn(), insert: vi.fn(), rpc: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({
  requirePortalAccess: m.portal,
  requireStaffAccess: m.staff,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.client }))
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }))

import {
  submitRepreneurFeedback,
  setRepreneurFeedbackStatus,
  redactRepreneurFeedback,
  deleteRepreneurFeedback,
} from "@/lib/actions/repreneur-feedback"

const id = "fa000000-0000-4000-8000-000000000001"
const owner = "fa000000-0000-4000-8000-000000000002"

beforeEach(() => {
  vi.clearAllMocks()
  m.portal.mockResolvedValue({ role: "repreneur", repreneurId: owner, user: { id: "auth-owner", email: "owner@example.test" } })
  m.staff.mockResolvedValue({ role: "staff", user: { id: "auth-staff", email: "staff@example.test" } })
  m.insert.mockResolvedValue({ error: null })
  m.rpc.mockResolvedValue({ data: { outcome: "updated", version: 2 }, error: null })
  m.from.mockReturnValue({ insert: m.insert })
  m.client.mockReturnValue({ from: m.from, rpc: m.rpc })
})

describe("repreneur submission boundary", () => {
  it("requires current PortalAccess before a service client exists", async () => {
    m.portal.mockRejectedValue(new Error("portal denied"))
    await expect(submitRepreneurFeedback({})).rejects.toThrow("portal denied")
    expect(m.client).not.toHaveBeenCalled()
  })

  it("derives owner identity and omits ID, time and status from the write and receipt", async () => {
    const result = await submitRepreneurFeedback({
      category: "improvement", message: "The opportunity list could be clearer.", context: "portal_deals",
    })
    expect(result).toEqual({ ok: true })
    expect(m.from).toHaveBeenCalledWith("repreneur_feedback")
    expect(m.insert).toHaveBeenCalledWith({
      sender_user_id: "auth-owner", sender_repreneur_id: owner,
      category: "improvement", message: "The opportunity list could be clearer.", context_key: "portal_deals",
    })
  })

  it("rejects forged identity and unlinked role without writing", async () => {
    expect((await submitRepreneurFeedback({ category: "other", message: "This message is long enough.", userId: "other" })).ok).toBe(false)
    m.portal.mockResolvedValue({ role: "staff", repreneurId: null, user: { id: "auth-staff" } })
    expect((await submitRepreneurFeedback({ category: "other", message: "This message is long enough." })).ok).toBe(false)
    expect(m.insert).not.toHaveBeenCalled()
  })
})

describe("staff-only triage", () => {
  it("requires current staff access before a service client exists", async () => {
    m.staff.mockRejectedValue(new Error("staff denied"))
    await expect(setRepreneurFeedbackStatus({ id, expectedVersion: 1, status: "routed" })).rejects.toThrow("staff denied")
    expect(m.client).not.toHaveBeenCalled()
  })

  it("passes only server-derived staff identity and the displayed version to the locked RPC", async () => {
    await expect(setRepreneurFeedbackStatus({ id, expectedVersion: 1, status: "routed" })).resolves.toEqual({ ok: true })
    expect(m.rpc).toHaveBeenCalledWith("staff_mutate_repreneur_feedback", {
      p_id: id, p_expected_version: 1, p_action: "status", p_new_status: "routed",
      p_actor_user_id: "auth-staff", p_actor_email: "staff@example.test",
    })
    expect(m.revalidate).toHaveBeenCalledWith("/tools/feedback")
  })

  it("maps stale, expired and already-redacted outcomes to a refresh, not success", async () => {
    for (const outcome of ["conflict", "expired", "already_redacted"] as const) {
      m.rpc.mockResolvedValueOnce({ data: { outcome }, error: null })
      await expect(redactRepreneurFeedback({ id, expectedVersion: 1 })).resolves.toMatchObject({
        ok: false, message: expect.stringContaining("Refresh"),
      })
    }
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it("uses the same version guard for permanent staff deletion", async () => {
    m.rpc.mockResolvedValue({ data: { outcome: "deleted" }, error: null })
    await expect(deleteRepreneurFeedback({ id, expectedVersion: 2 })).resolves.toEqual({ ok: true })
    expect(m.rpc).toHaveBeenCalledWith("staff_mutate_repreneur_feedback", expect.objectContaining({
      p_id: id, p_expected_version: 2, p_action: "delete", p_new_status: null,
    }))
  })
})
