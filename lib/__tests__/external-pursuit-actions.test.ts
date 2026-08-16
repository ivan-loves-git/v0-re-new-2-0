import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}))

import { updateExternalPursuit } from "@/lib/actions/external-pursuits"

describe("External Pursuit patch actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue({
      role: "staff",
      repreneurId: null,
      user: { id: "staff-1" },
    })
    mocks.rpc.mockResolvedValue({ data: null, error: null })
  })

  it("treats explicit undefined optional values as omitted", async () => {
    await expect(updateExternalPursuit("dossier-1", {
      title: "Preserve existing values",
      stage: undefined,
      availability: undefined,
      dueAt: undefined,
      sharedNotes: undefined,
      staffInternalNotes: undefined,
    }, "00000000-0000-4000-8000-000000000001")).resolves.toMatchObject({ success: true })

    expect(mocks.rpc).toHaveBeenCalledWith("update_external_pursuit", expect.objectContaining({
      p_stage_provided: false,
      p_availability_provided: false,
      p_due_at_provided: false,
      p_shared_notes_provided: false,
      p_staff_notes_provided: false,
    }))
  })

  it("keeps null as an explicit clear for nullable values", async () => {
    await updateExternalPursuit("dossier-1", {
      title: "Clear nullable values",
      dueAt: null,
      sharedNotes: null,
      staffInternalNotes: null,
    }, "00000000-0000-4000-8000-000000000002")

    expect(mocks.rpc).toHaveBeenCalledWith("update_external_pursuit", expect.objectContaining({
      p_due_at: null,
      p_due_at_provided: true,
      p_shared_notes: null,
      p_shared_notes_provided: true,
      p_staff_internal_notes: null,
      p_staff_notes_provided: true,
    }))
  })
})
