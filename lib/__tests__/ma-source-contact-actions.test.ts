import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

import {
  createMaSource,
  createMaSourceContact,
  updateMaSource,
  updateMaSourceContact,
} from "@/lib/actions/ma-sources"

describe("legacy M&A directory mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  it.each([
    ["create firm", () => createMaSource(new FormData())],
    ["update firm", () => updateMaSource("source-001", new FormData())],
    [
      "create contact",
      () => createMaSourceContact("source-001", new FormData()),
    ],
    [
      "move or update contact",
      () => updateMaSourceContact("source-001", "contact-001", new FormData()),
    ],
  ])(
    "guards legacy %s without opening an admin client",
    async (_label, action) => {
      await expect(action()).resolves.toEqual({
        success: false,
        message:
          "Legacy M&A directory editing is retired. Use Opportunity Intake to create the canonical firm, office, and contact context.",
      })

      expect(mocks.requireStaffAccess).toHaveBeenCalledTimes(1)
      expect(mocks.createAdminClient).not.toHaveBeenCalled()
    },
  )
})
