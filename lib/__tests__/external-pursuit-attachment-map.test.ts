import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getCurrentUserAccess: vi.fn(),
  rpc: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  getCurrentUserAccess: mocks.getCurrentUserAccess,
}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { getExternalPursuitAttachmentMap } from "@/lib/actions/external-pursuit-attachments"

describe("External Pursuit attachment board map", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "repreneur", repreneurId: "owner-1", user: { id: "owner-user" } })
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc })
  })

  it("loads unique board dossiers through one role-safe metadata projection and preserves empty entries", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          external_pursuit_id: "dossier-1",
          id: "attachment-1",
          original_filename: "First memo.pdf",
          content_type: "application/pdf",
          byte_size: 1024,
          uploader_label: "You",
          created_at: "2026-08-18T09:00:00Z",
        },
        {
          external_pursuit_id: "dossier-1",
          id: "attachment-2",
          original_filename: "Second memo.pdf",
          content_type: "application/pdf",
          byte_size: 2048,
          uploader_label: "Re-New staff",
          created_at: "2026-08-18T10:00:00Z",
        },
      ],
      error: null,
    })

    await expect(getExternalPursuitAttachmentMap(["dossier-1", "dossier-2", "dossier-1"]))
      .resolves.toEqual({
        "dossier-1": [
          expect.objectContaining({ id: "attachment-1", original_filename: "First memo.pdf" }),
          expect.objectContaining({ id: "attachment-2", original_filename: "Second memo.pdf" }),
        ],
        "dossier-2": [],
      })

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith("external_pursuit_attachment_map_for_actor", {
      p_dossier_ids: ["dossier-1", "dossier-2"],
      p_actor_user_id: "owner-user",
    })
  })

  it("denies an unassigned caller before creating a service-role client", async () => {
    mocks.getCurrentUserAccess.mockResolvedValue({ role: "unassigned", user: { id: "unknown" } })

    await expect(getExternalPursuitAttachmentMap(["dossier-1"])).rejects.toThrow("External Pursuit access denied.")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
