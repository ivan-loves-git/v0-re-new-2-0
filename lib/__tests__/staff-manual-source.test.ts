import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateRepreneurDashboardTags: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/auth-server", () => ({ requireUser: mocks.requireUser }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateRepreneurDashboardTags: mocks.revalidateRepreneurDashboardTags,
}))

import { createRepreneur, updateRepreneur } from "@/lib/actions/repreneurs"
import { SOURCE_OPTIONS } from "@/lib/types/repreneur"

function validCreateForm(source?: string) {
  const formData = new FormData()
  formData.set("first_name", "TEST")
  formData.set("last_name", "Staff Source")
  formData.set("email", "staff-source@example.invalid")
  if (source) formData.set("source", source)
  return formData
}

describe("staff-manual repreneur source", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: "staff-user" })
  })

  it("offers Staff manual as an explicit staff-form source", () => {
    expect(SOURCE_OPTIONS).toContainEqual({
      value: "staff_manual",
      label: "Staff manual",
    })
  })

  it("defaults a staff-created profile to staff_manual when source is omitted", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "repreneur-1" }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await createRepreneur(validCreateForm())

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "staff_manual" }),
    )
  })

  it("preserves an explicit source supplied by the staff form", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "repreneur-2" }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => ({ insert })) })

    await createRepreneur(validCreateForm("referral"))

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "referral" }),
    )
  })

  it("preserves an explicit existing source when staff edits a profile", async () => {
    const existingSingle = vi.fn().mockResolvedValue({
      data: { marketing_consent: false },
      error: null,
    })
    const selectEq = vi.fn(() => ({ single: existingSingle }))
    const select = vi.fn(() => ({ eq: selectEq }))
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ select, update })),
    })

    await updateRepreneur("repreneur-1", validCreateForm("referral"))

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ source: "referral" }),
    )
  })
})
