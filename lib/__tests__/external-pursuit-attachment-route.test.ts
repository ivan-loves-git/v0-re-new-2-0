import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAccess: vi.fn(),
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  createSignedUrl: vi.fn(),
}))
vi.mock("@/lib/access-control", () => ({ getCurrentUserAccessFromHeaders: mocks.getAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))

import { GET } from "@/app/api/external-pursuits/[pursuitId]/attachments/[attachmentId]/route"

function request() {
  return GET(new Request("http://localhost/api/external-pursuits/dossier-1/attachments/file-1"), {
    params: Promise.resolve({ pursuitId: "dossier-1", attachmentId: "file-1" }),
  })
}

describe("External Pursuit attachment download route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAccess.mockResolvedValue({ role: "repreneur", repreneurId: "owner-1", user: { id: "owner-user" } })
    mocks.rpc.mockResolvedValue({ data: [{ storage_path: "dossier-1/random.pdf", original_filename: "Memo.pdf" }], error: null })
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example.test/private" }, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc, storage: { from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })) } })
  })

  it("rejects an unassigned session before any service-role lookup", async () => {
    mocks.getAccess.mockResolvedValue({ role: "unassigned", user: { id: "unknown" } })
    expect((await request()).status).toBe(404)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("does not sign a URL when exact dossier/attachment access is denied", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("External Pursuit access denied.") })
    expect((await request()).status).toBe(404)
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it("returns a private 60-second download redirect after exact authorization", async () => {
    const response = await request()
    expect(response.status).toBe(307)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(mocks.rpc).toHaveBeenCalledWith("external_pursuit_attachment_for_actor", {
      p_dossier_id: "dossier-1", p_attachment_id: "file-1", p_actor_user_id: "owner-user",
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("dossier-1/random.pdf", 60, { download: "Memo.pdf" })
  })
})
