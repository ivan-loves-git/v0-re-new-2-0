import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireStaffAccess: vi.fn(),
  revalidateOpportunityDashboardTags: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/data/dashboard-snapshots", () => ({
  revalidateOpportunityDashboardTags: mocks.revalidateOpportunityDashboardTags,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createMaSource,
  createMaSourceContact,
  updateMaSourceContact,
} from "@/lib/actions/ma-sources"

function contactForm(values: { name?: string; email?: string; phone?: string } = {}) {
  const formData = new FormData()
  if (values.name) formData.set("contact_name", values.name)
  if (values.email) formData.set("contact_email", values.email)
  if (values.phone) formData.set("contact_phone", values.phone)
  return formData
}

describe("M&A source contact actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  it("keeps an initial firm contact in ma_source_contacts instead of firm fields", async () => {
    const sourceSingle = vi.fn().mockResolvedValue({ data: { id: "source-001" }, error: null })
    const sourceSelect = vi.fn(() => ({ single: sourceSingle }))
    const sourceInsert = vi.fn(() => ({ select: sourceSelect }))
    const contactInsert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn((table: string) => {
      if (table === "ma_sources") return { insert: sourceInsert }
      if (table === "ma_source_contacts") return { insert: contactInsert }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({ from })

    const formData = contactForm({
      name: "Camille Durand",
      email: "camille@example.com",
      phone: "+33 6 12 34 56 78",
    })
    formData.set("firm_name", "Cabinet Atlantique")
    formData.set("source_type", "ma_firm")
    formData.set("internal_notes", "Regional industrial opportunities")

    await expect(createMaSource(formData)).resolves.toEqual({
      success: true,
      message: "M&A source created",
    })

    expect(sourceInsert).toHaveBeenCalledWith({
      firm_name: "Cabinet Atlantique",
      source_type: "ma_firm",
      internal_notes: "Regional industrial opportunities",
      created_by: "staff-001",
    })
    expect(contactInsert).toHaveBeenCalledWith({
      source_id: "source-001",
      name: "Camille Durand",
      email: "camille@example.com",
      phone: "+33 6 12 34 56 78",
      created_by: "staff-001",
    })
  })

  it("requires staff access and validates contact email before opening a database client", async () => {
    const result = await createMaSourceContact(
      "source-001",
      contactForm({ name: "Camille", email: "not-an-email" }),
    )

    expect(result).toEqual({
      success: false,
      message: "Contact email is not valid",
    })
    expect(mocks.requireStaffAccess).toHaveBeenCalledTimes(1)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("updates a contact only when it belongs to the supplied firm", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "contact-001" }, error: null })
    const select = vi.fn(() => ({ maybeSingle }))
    const sourceEq = vi.fn(() => ({ select }))
    const contactEq = vi.fn(() => ({ eq: sourceEq }))
    const update = vi.fn(() => ({ eq: contactEq }))
    const from = vi.fn((table: string) => {
      if (table === "ma_source_contacts") return { update }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({ from })

    await expect(
      updateMaSourceContact(
        "source-001",
        "contact-001",
        contactForm({ name: "Camille Durand", email: "camille@example.com" }),
      ),
    ).resolves.toEqual({ success: true, message: "M&A contact updated" })

    expect(update).toHaveBeenCalledWith({
      name: "Camille Durand",
      email: "camille@example.com",
      phone: null,
    })
    expect(contactEq).toHaveBeenCalledWith("id", "contact-001")
    expect(sourceEq).toHaveBeenCalledWith("source_id", "source-001")
  })
})
