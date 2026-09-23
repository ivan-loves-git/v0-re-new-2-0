import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  verifySelection: vi.fn(),
  rpc: vi.fn(),
  deleteAttachment: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/staff-portal-selection", () => ({ verifyStaffPortalSelection: mocks.verifySelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock("@/lib/actions/external-pursuit-attachments", () => ({ deleteExternalPursuitAttachment: mocks.deleteAttachment }))

import {
  confirmSelectedExternalPursuitCurrent,
  createSelectedExternalPursuit,
  deleteSelectedExternalPursuitAttachment,
  moveSelectedExternalPursuitStage,
  updateSelectedExternalPursuit,
} from "@/lib/actions/staff-portal-external"

const ownerId = "10000000-0000-4000-8000-000000000001"
const otherOwnerId = "10000000-0000-4000-8000-000000000002"
const pursuitId = "10000000-0000-4000-8000-000000000003"
const attachmentId = "10000000-0000-4000-8000-000000000004"
const workspaceId = "10000000-0000-4000-8000-000000000005"
const generation = "10000000-0000-4000-8000-000000000006"

describe("selected-owner staff External assistance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1", email: "staff@example.test" } })
    mocks.verifySelection.mockResolvedValue({ ownerId, workspaceId, generation })
    mocks.rpc.mockResolvedValue({ data: { pursuitId }, error: null })
  })

  it("binds create to the selected owner and actual staff actor", async () => {
    await expect(createSelectedExternalPursuit(ownerId, "token", { title: "Other", ownerRepreneurId: otherOwnerId }, "key"))
      .rejects.toThrow("selected repreneur")
    expect(mocks.rpc).not.toHaveBeenCalled()
    await createSelectedExternalPursuit(ownerId, "token", { title: "One", ownerRepreneurId: ownerId }, "key")
    expect(mocks.rpc).toHaveBeenCalledWith("w196_selected_external_operation", expect.objectContaining({
      p_workspace_id: workspaceId,
      p_generation: generation,
      p_owner_id: ownerId,
      p_staff_user_id: "staff-1",
      p_staff_email: "staff@example.test",
      p_action: "create",
      p_args: { title: "One", ownerRepreneurId: ownerId },
    }))
  })

  it("rejects stale A actions after A to B and staff-only note injection", async () => {
    mocks.verifySelection.mockResolvedValue(null)
    await expect(updateSelectedExternalPursuit(ownerId, "old-token", pursuitId, { title: "Changed" }, "key"))
      .rejects.toThrow("workspace changed")
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.verifySelection.mockResolvedValue({ ownerId, workspaceId, generation })
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId,
      { title: "Changed", staffInternalNotes: "private" }, "key"))
      .rejects.toThrow("Staff-only notes")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("routes stage and current-status confirmation through the same selected transaction", async () => {
    await moveSelectedExternalPursuitStage(ownerId, "token", pursuitId, "contact_qualification", "stage-key")
    expect(mocks.rpc).toHaveBeenCalledWith("w196_selected_external_operation", expect.objectContaining({
      p_action: "stage", p_dossier_id: pursuitId, p_args: { stage: "contact_qualification" },
    }))
    const confirmed = await confirmSelectedExternalPursuitCurrent(ownerId, "token", pursuitId, "confirm-key")
    expect(confirmed).toMatchObject({ success: true, outcome: "confirmed" })
    expect(mocks.rpc).toHaveBeenCalledWith("w196_selected_external_operation", expect.objectContaining({
      p_action: "confirm", p_dossier_id: pursuitId, p_idempotency_key: "confirm-key",
    }))
  })

  it("passes the selected context to both phases of attachment removal", async () => {
    await deleteSelectedExternalPursuitAttachment(ownerId, "token", pursuitId, attachmentId, "remove-key")
    expect(mocks.deleteAttachment).toHaveBeenCalledWith(pursuitId, attachmentId, "remove-key", {
      ownerId, workspaceId, generation,
    })
  })
})
