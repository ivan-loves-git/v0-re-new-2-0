import { beforeEach, describe, expect, it, vi } from "vitest"

const boundary = vi.hoisted(() => ({
  browserValue: "en" as string | null,
  rows: new Map<string, string>(),
  from: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => name === "renew-language" && boundary.browserValue
    ? { value: boundary.browserValue } : undefined }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: boundary.from,
  }),
}))

import { anonymousUiLanguage, resolvedRepreneurUiLanguage } from "@/lib/i18n/server-language"

describe("server-resolved repreneur language", () => {
  beforeEach(() => {
    boundary.browserValue = "en"
    boundary.rows = new Map()
    boundary.from.mockReset()
    boundary.from.mockImplementation(() => ({
      select: () => ({
        eq: (_column: string, userId: string) => ({
          maybeSingle: async () => ({ data: boundary.rows.has(userId)
            ? { language: boundary.rows.get(userId) } : null, error: null }),
        }),
      }),
    }))
  })

  it("keeps two accounts separate in one browser and never infers a row", async () => {
    boundary.rows.set("auth-user-a", "fr")
    expect(await resolvedRepreneurUiLanguage("auth-user-a")).toEqual({
      accountLanguage: "fr", language: "fr",
    })
    expect(await resolvedRepreneurUiLanguage("auth-user-b")).toEqual({
      accountLanguage: null, language: "en",
    })
    expect(boundary.from).toHaveBeenCalledWith("repreneur_ui_preferences")
    expect(await anonymousUiLanguage()).toBe("en")

    boundary.browserValue = null
    expect(await resolvedRepreneurUiLanguage("auth-user-b")).toEqual({
      accountLanguage: null, language: "fr",
    })
  })
})
