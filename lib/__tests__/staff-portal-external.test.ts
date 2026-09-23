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

  it("rejects unsafe External URLs on both selected create and update before an RPC", async () => {
    const unsafe = { title: "Unsafe", externalUrl: "javascript:alert(1)" }
    await expect(createSelectedExternalPursuit(ownerId, "token", { ...unsafe, ownerRepreneurId: ownerId }, "create-key"))
      .resolves.toMatchObject({ success: false, message: "External URL must start with http:// or https://." })
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId, unsafe, "update-key"))
      .resolves.toMatchObject({ success: false, message: "External URL must start with http:// or https://." })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("retains the ordinary External due-date and metric limits for selected writes", async () => {
    await expect(createSelectedExternalPursuit(ownerId, "token", {
      title: "Invalid date", ownerRepreneurId: ownerId, dueAt: "2026-02-30",
    }, "date-key")).resolves.toMatchObject({ success: false, message: "Due date must use a valid YYYY-MM-DD date." })
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId, {
      title: "Invalid metric", revenueMeur: -1,
    }, "metric-key")).resolves.toMatchObject({ success: false, message: "External metrics must be zero or greater." })
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId, {
      title: "Invalid headcount", headcount: 1.5,
    }, "headcount-key")).resolves.toMatchObject({ success: false, message: "Headcount must be a whole number." })
    expect(mocks.rpc).not.toHaveBeenCalled()
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

  it("passes the selected context to attachment-removal preflight", async () => {
    await deleteSelectedExternalPursuitAttachment(ownerId, "token", pursuitId, attachmentId, "remove-key")
    expect(mocks.deleteAttachment).toHaveBeenCalledWith(pursuitId, attachmentId, "remove-key", {
      ownerId, workspaceId, generation,
    })
  })

  it("rejects a new stale attachment deletion before touching storage", async () => {
    mocks.verifySelection.mockResolvedValue(null)
    await expect(deleteSelectedExternalPursuitAttachment(ownerId, "old-token", pursuitId, attachmentId, "remove-key"))
      .rejects.toThrow("workspace changed")
    expect(mocks.deleteAttachment).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
