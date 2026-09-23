import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  verifySelection: vi.fn(),
  from: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  move: vi.fn(),
  contact: vi.fn(),
  followUp: vi.fn(),
  deleteAttachment: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/access-control", () => ({ requireStaffAccess: mocks.requireStaffAccess }))
vi.mock("@/lib/staff-portal-selection", () => ({ verifyStaffPortalSelection: mocks.verifySelection }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock("@/lib/actions/external-pursuits", () => ({
  createExternalPursuit: mocks.create,
  updateExternalPursuit: mocks.update,
  updateExternalPursuitFollowUp: mocks.followUp,
  moveExternalPursuitStage: mocks.move,
  saveExternalPursuitContact: mocks.contact,
}))
vi.mock("@/lib/actions/external-pursuit-attachments", () => ({ deleteExternalPursuitAttachment: mocks.deleteAttachment }))

import {
  createSelectedExternalPursuit,
  moveSelectedExternalPursuitStage,
  saveSelectedExternalPursuitContact,
  updateSelectedExternalPursuit,
  updateSelectedExternalPursuitFollowUp,
  deleteSelectedExternalPursuitAttachment,
} from "@/lib/actions/staff-portal-external"

const ownerId = "10000000-0000-4000-8000-000000000001"
const otherOwnerId = "10000000-0000-4000-8000-000000000002"
const pursuitId = "10000000-0000-4000-8000-000000000003"

function query(row: Record<string, unknown> | null) {
  const chain = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe("selected-owner staff External assistance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.verifySelection.mockReturnValue(true)
    mocks.from.mockImplementation((table: string) => table === "repreneurs"
      ? query({ id: ownerId })
      : query({ id: pursuitId, owner_repreneur_id: ownerId, deletion_status: "active" }))
    mocks.create.mockResolvedValue({ success: true, pursuitId })
    mocks.update.mockResolvedValue({ success: true, pursuitId })
    mocks.move.mockResolvedValue({ success: true, pursuitId })
    mocks.contact.mockResolvedValue({ success: true, pursuitId })
    mocks.followUp.mockResolvedValue({ success: true, pursuitId })
  })

  it("requires the actor-bound token and exact selected owner before create", async () => {
    mocks.verifySelection.mockReturnValue(false)
    await expect(createSelectedExternalPursuit(ownerId, "wrong-token", { title: "One", ownerRepreneurId: ownerId }, "key"))
      .rejects.toThrow("selected repreneur changed")
    expect(mocks.create).not.toHaveBeenCalled()
    mocks.verifySelection.mockReturnValue(true)
    await expect(createSelectedExternalPursuit(ownerId, "token", { title: "Other", ownerRepreneurId: otherOwnerId }, "key"))
      .rejects.toThrow("selected repreneur")
    expect(mocks.create).not.toHaveBeenCalled()
    await createSelectedExternalPursuit(ownerId, "token", { title: "One", ownerRepreneurId: ownerId }, "key")
    expect(mocks.create).toHaveBeenCalledWith({ title: "One", ownerRepreneurId: ownerId }, "key")
  })

  it("denies another owner and staff-only note injection before update", async () => {
    mocks.from.mockImplementation((table: string) => table === "repreneurs"
      ? query({ id: ownerId })
      : query({ id: pursuitId, owner_repreneur_id: otherOwnerId, deletion_status: "active" }))
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId, { title: "Changed" }, "key"))
      .rejects.toThrow("selected repreneur")
    expect(mocks.update).not.toHaveBeenCalled()
    mocks.from.mockImplementation((table: string) => table === "repreneurs"
      ? query({ id: ownerId })
      : query({ id: pursuitId, owner_repreneur_id: ownerId, deletion_status: "active" }))
    await expect(updateSelectedExternalPursuit(ownerId, "token", pursuitId,
      { title: "Changed", staffInternalNotes: "private" }, "key"))
      .rejects.toThrow("Staff-only notes")
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("binds shared follow-up and file removal to the selected dossier", async () => {
    await moveSelectedExternalPursuitStage(ownerId, "token", pursuitId, "contact_qualification", "key-stage")
    expect(mocks.move).toHaveBeenCalledWith(pursuitId, "contact_qualification", "key-stage")
    await saveSelectedExternalPursuitContact(ownerId, "token", pursuitId, { name: "Synthetic contact" }, "key-contact")
    expect(mocks.contact).toHaveBeenCalledWith(pursuitId, { name: "Synthetic contact" }, "key-contact")
    await updateSelectedExternalPursuitFollowUp(ownerId, "token", pursuitId, { sharedNotes: "Call back" }, "key")
    expect(mocks.followUp).toHaveBeenCalledWith(pursuitId, { sharedNotes: "Call back" }, "key")
    await deleteSelectedExternalPursuitAttachment(ownerId, "token", pursuitId, "file-id", "key")
    expect(mocks.deleteAttachment).toHaveBeenCalledWith(pursuitId, "file-id", "key")
  })
})
