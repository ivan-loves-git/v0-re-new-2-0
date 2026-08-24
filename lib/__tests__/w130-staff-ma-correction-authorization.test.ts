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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  updateMaContactCorrection,
  updateMaFirmCorrection,
  updateMaOfficeCorrection,
} from "@/lib/actions/ma-relationship-workspaces"

const firmId = "11111111-1111-4111-8111-111111111111"
const officeId = "22222222-2222-4222-8222-222222222222"
const contactId = "33333333-3333-4333-8333-333333333333"
const affiliationId = "44444444-4444-4444-8444-444444444444"

describe("W-130 staff correction authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockRejectedValue(new Error("Staff access required"))
  })

  it.each([
    ["firm", () => updateMaFirmCorrection(firmId, new FormData())],
    ["office", () => updateMaOfficeCorrection(officeId, new FormData())],
    [
      "contact affiliation",
      () => updateMaContactCorrection(contactId, affiliationId, new FormData()),
    ],
  ])("denies a non-staff %s correction before creating an admin client", async (_target, action) => {
    await expect(action()).rejects.toThrow("Staff access required")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
