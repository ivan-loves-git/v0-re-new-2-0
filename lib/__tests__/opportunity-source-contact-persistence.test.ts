import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  redirect: vi.fn(),
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

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

import { createOpportunity, updateOpportunity } from "@/lib/actions/opportunities"

const SOURCE_ID = "00000000-0000-4000-8000-000000000001"
const CONTACT_ID = "00000000-0000-4000-8000-000000000002"

function completeForm() {
  const formData = new FormData()
  formData.set("reference", "OPP-001")
  formData.set("status", "active")
  formData.set("sector_choice", "Tech & Digital")
  formData.set("sector", "Tech & Digital")
  formData.set("location", "Paris")
  formData.set("description", "A valid internal opportunity record.")
  formData.set("date_added", "2026-07-19")
  formData.set("public_title", "An anonymized opportunity title")
  formData.set("teaser_summary", "An anonymized opportunity summary.")
  formData.set("revenue_meur", "1")
  formData.set("ebitda_keur", "100")
  formData.set("headcount_range", "12")
  formData.set("source_id", SOURCE_ID)
  formData.set("source_label", "Original confidential source label")
  formData.set("source_firm_name", "Cabinet Atlantique")
  formData.set("source_type", "ma_firm")
  formData.set("source_contacts_submitted", "true")
  formData.set("source_contact_ids", CONTACT_ID)
  formData.set("source_primary_contact_id", CONTACT_ID)
  return formData
}

describe("opportunity source-contact persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  it("replaces only this opportunity's links and stores a selected primary contact", async () => {
    const existingMaybeSingle = vi.fn().mockResolvedValue({
      data: { status: "active", source_id: SOURCE_ID },
      error: null,
    })
    const existingEq = vi.fn(() => ({ maybeSingle: existingMaybeSingle }))
    const opportunitySelect = vi.fn(() => ({ eq: existingEq }))
    const opportunityUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const opportunityUpdate = vi.fn(() => ({ eq: opportunityUpdateEq }))

    const sourceUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const sourceUpdate = vi.fn(() => ({ eq: sourceUpdateEq }))

    const contactIn = vi.fn().mockResolvedValue({ data: [{ id: CONTACT_ID }], error: null })
    const contactSourceEq = vi.fn(() => ({ in: contactIn }))
    const contactSelect = vi.fn(() => ({ eq: contactSourceEq }))

    const relationDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const relationDelete = vi.fn(() => ({ eq: relationDeleteEq }))
    const relationInsert = vi.fn().mockResolvedValue({ error: null })

    const from = vi.fn((table: string) => {
      if (table === "opportunities") return { select: opportunitySelect, update: opportunityUpdate }
      if (table === "ma_sources") return { update: sourceUpdate }
      if (table === "ma_source_contacts") return { select: contactSelect }
      if (table === "opportunity_source_contacts")
        return { delete: relationDelete, insert: relationInsert }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({ from })

    await expect(updateOpportunity("opportunity-001", completeForm())).resolves.toEqual({
      success: true,
      message: "Opportunity saved.",
    })

    expect(relationDeleteEq).toHaveBeenCalledWith("opportunity_id", "opportunity-001")
    expect(contactSourceEq).toHaveBeenCalledWith("source_id", SOURCE_ID)
    expect(contactIn).toHaveBeenCalledWith("id", [CONTACT_ID])
    expect(contactIn.mock.invocationCallOrder[0]).toBeLessThan(
      relationDeleteEq.mock.invocationCallOrder[0],
    )
    expect(opportunityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        source_label: "Original confidential source label",
      }),
    )
    expect(relationInsert).toHaveBeenCalledWith([
      {
        opportunity_id: "opportunity-001",
        source_id: SOURCE_ID,
        contact_id: CONTACT_ID,
        is_primary: true,
        created_by: "staff-001",
      },
    ])
  })

  it("reuses a selected existing firm contact without modifying that firm's shared fields", async () => {
    const sourceUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const sourceUpdate = vi.fn(() => ({ eq: sourceUpdateEq }))

    const opportunitySingle = vi.fn().mockResolvedValue({
      data: { id: "opportunity-created" },
      error: null,
    })
    const opportunitySelect = vi.fn(() => ({ single: opportunitySingle }))
    const opportunityInsert = vi.fn(() => ({ select: opportunitySelect }))

    const contactIn = vi.fn().mockResolvedValue({ data: [{ id: CONTACT_ID }], error: null })
    const contactSourceEq = vi.fn(() => ({ in: contactIn }))
    const contactSelect = vi.fn(() => ({ eq: contactSourceEq }))
    const contactInsert = vi.fn()

    const relationDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const relationDelete = vi.fn(() => ({ eq: relationDeleteEq }))
    const relationInsert = vi.fn().mockResolvedValue({ error: null })

    const from = vi.fn((table: string) => {
      if (table === "ma_sources") return { update: sourceUpdate }
      if (table === "opportunities") return { insert: opportunityInsert }
      if (table === "ma_source_contacts") return { select: contactSelect, insert: contactInsert }
      if (table === "opportunity_source_contacts") {
        return { delete: relationDelete, insert: relationInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createAdminClient.mockReturnValue({ from })

    await expect(createOpportunity(completeForm())).resolves.toBeUndefined()

    expect(sourceUpdate).not.toHaveBeenCalled()
    expect(contactInsert).not.toHaveBeenCalled()
    expect(opportunityInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_id: SOURCE_ID }),
    )
    expect(contactIn).toHaveBeenCalledWith("id", [CONTACT_ID])
    expect(relationInsert).toHaveBeenCalledWith([
      {
        opportunity_id: "opportunity-created",
        source_id: SOURCE_ID,
        contact_id: CONTACT_ID,
        is_primary: true,
        created_by: "staff-001",
      },
    ])
  })
})
