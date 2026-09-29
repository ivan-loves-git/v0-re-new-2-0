import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({
  requirePortalAccess: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({ requirePortalAccess: boundary.requirePortalAccess }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: boundary.from }) }))

import { saveMyUiLanguage } from "@/lib/actions/repreneur-ui-language"

describe("own repreneur UI language", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boundary.requirePortalAccess.mockResolvedValue({ user: { id: "auth-user-a" }, role: "repreneur", repreneurId: "profile-a" })
    boundary.from.mockReturnValue({ upsert: boundary.upsert })
    boundary.upsert.mockResolvedValue({ error: null })
  })

  it("rejects unsupported language before database access", async () => {
    expect(await saveMyUiLanguage("de")).toEqual({ ok: false, code: "invalid_language" })
    expect(boundary.requirePortalAccess).not.toHaveBeenCalled()
    expect(boundary.from).not.toHaveBeenCalled()
  })

  it("saves only the authenticated Better Auth identity", async () => {
    expect(await saveMyUiLanguage("en")).toEqual({ ok: true })
    expect(boundary.from).toHaveBeenCalledWith("repreneur_ui_preferences")
    expect(boundary.upsert).toHaveBeenCalledWith(
      { user_id: "auth-user-a", language: "en" },
      { onConflict: "user_id" },
    )
  })

  it("reports persistence failure without claiming success", async () => {
    boundary.upsert.mockResolvedValue({ error: { message: "private database detail" } })
    expect(await saveMyUiLanguage("fr")).toEqual({ ok: false, code: "save_unavailable" })
  })

  it("does not access storage when the portal gate denies the caller", async () => {
    boundary.requirePortalAccess.mockRejectedValue(new Error("denied"))
    await expect(saveMyUiLanguage("fr")).rejects.toThrow("denied")
    expect(boundary.from).not.toHaveBeenCalled()
  })
})
