import { readFileSync } from "node:fs"
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

import {
  createOpportunityFromDraft,
  createOpportunity,
  updateOpportunity,
} from "@/lib/actions/opportunities"
import {
  findIncompleteOpportunityDataFields,
  readOpportunityHeadcount,
  readOpportunityNumber,
} from "@/lib/utils/opportunity-incomplete-data"

const MISSING_FIELDS = [
  "revenue_meur",
  "ebitda_keur",
  "headcount_range",
  "source_firm_name",
  "source_contact",
]

function validOpportunityForm() {
  const formData = new FormData()
  formData.set("reference", "OPP-001")
  formData.set("status", "draft")
  formData.set("sector_choice", "Tech & Digital")
  formData.set("sector", "Tech & Digital")
  formData.set("location", "Paris")
  formData.set("description", "A valid internal opportunity record.")
  formData.set("date_added", "2026-07-19")
  formData.set("public_title", "An anonymized opportunity title")
  formData.set("teaser_summary", "An anonymized opportunity summary.")
  return formData
}

function setupCreateClient() {
  const single = vi
    .fn()
    .mockResolvedValue({ data: { id: "created-opportunity" }, error: null })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  mocks.createAdminClient.mockReturnValue({ from })
  return { from, insert }
}

function setupUpdateClient() {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { status: "active" }, error: null })
  const selectEq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn(() => ({ eq: updateEq }))
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const remove = vi.fn(() => ({ eq: deleteEq }))
  const sourceSingle = vi
    .fn()
    .mockResolvedValue({ data: { id: "source-001" }, error: null })
  const sourceSelect = vi.fn(() => ({ single: sourceSingle }))
  const sourceInsert = vi.fn(() => ({ select: sourceSelect }))
  const sourceUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const sourceUpdate = vi.fn(() => ({ eq: sourceUpdateEq }))
  const from = vi.fn((table: string) => {
    if (table === "ma_sources") return { insert: sourceInsert, update: sourceUpdate }
    return { select, update, delete: remove }
  })
  mocks.createAdminClient.mockReturnValue({ from })
  return { from, sourceInsert, sourceUpdate, update }
}

describe("incomplete opportunity data warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "qa-staff" } })
  })

  it("keeps missing values null while preserving confirmed numeric zero", () => {
    const missing = validOpportunityForm()
    expect(readOpportunityNumber(missing, "revenue_meur")).toBeNull()
    expect(readOpportunityNumber(missing, "ebitda_keur")).toBeNull()
    expect(readOpportunityHeadcount(missing)).toBeNull()
    expect(findIncompleteOpportunityDataFields(missing)).toEqual(MISSING_FIELDS)

    const zero = validOpportunityForm()
    zero.set("revenue_meur", "0")
    zero.set("ebitda_keur", "0")
    zero.set("headcount_range", "0")
    zero.set("source_firm_name", "Source firm")
    zero.set("new_source_contact_name", "Source contact")

    expect(readOpportunityNumber(zero, "revenue_meur")).toBe(0)
    expect(readOpportunityNumber(zero, "ebitda_keur")).toBe(0)
    expect(readOpportunityHeadcount(zero)).toBe(0)
    expect(findIncompleteOpportunityDataFields(zero)).toEqual([])
  })

  it("returns a first-pass warning for both create and edit without persisting", async () => {
    const createResult = await createOpportunity(validOpportunityForm())
    const updateResult = await updateOpportunity(
      "opportunity-001",
      validOpportunityForm(),
    )

    for (const result of [createResult, updateResult]) {
      expect(result).toEqual({
        success: false,
        message: "Incomplete data — this opportunity may not match correctly.",
        incompleteData: { missingFields: MISSING_FIELDS },
      })
    }
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("preserves the warning submission values for an acknowledged resubmit", async () => {
    const formData = validOpportunityForm()
    formData.set("reference", "OPP-RETAINED")
    formData.set("location", "Lyon")

    await expect(createOpportunity(formData)).resolves.toMatchObject({
      success: false,
      incompleteData: { missingFields: MISSING_FIELDS },
    })

    formData.set("acknowledge_incomplete_data", "true")
    const { insert } = setupCreateClient()

    await createOpportunity(formData)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "OPP-RETAINED",
        sector: "Tech & Digital",
        location: "Lyon",
        description: "A valid internal opportunity record.",
        date_added: "2026-07-19",
        teaser_summary: "An anonymized opportunity summary.",
        revenue_meur: null,
        ebitda_keur: null,
        headcount: null,
      }),
    )
  })

  it("saves an acknowledged create with unknown fields stored as null", async () => {
    const formData = validOpportunityForm()
    formData.set("acknowledge_incomplete_data", "true")
    const { insert } = setupCreateClient()

    await createOpportunity(formData)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        revenue_meur: null,
        ebitda_keur: null,
        headcount: null,
        headcount_range: null,
        source_id: null,
        source_label: null,
      }),
    )
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/opportunities/created-opportunity",
    )
  })

  it("does not persist an active opportunity draft without a verified source", async () => {
    await expect(
      createOpportunityFromDraft({
        reference: "OPP-NO-SOURCE",
        status: "active",
        public_title: "An anonymized opportunity title",
        repreneur_exposure: "anonymized",
      }),
    ).rejects.toThrow("A verified M&A source is required before an opportunity can become active.")

    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects missing or whitespace-only public titles before creating", async () => {
    for (const publicTitle of ["", "   "]) {
      const formData = validOpportunityForm()
      formData.set("public_title", publicTitle)

      await expect(createOpportunity(formData)).resolves.toEqual({
        success: false,
        message: "Public title is required before creating an opportunity.",
        fieldErrors: { public_title: "Public title is required." },
      })
    }

    await expect(
      createOpportunityFromDraft({
        reference: "OPP-NO-TITLE",
        public_title: "  ",
      }),
    ).rejects.toThrow("Public title is required before creating an opportunity.")
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("persists a trimmed public title for a valid create", async () => {
    const formData = validOpportunityForm()
    formData.set("public_title", "  Precision engineering business  ")
    formData.set("acknowledge_incomplete_data", "true")
    const { insert } = setupCreateClient()

    await createOpportunity(formData)

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        public_title: "Precision engineering business",
      }),
    )
  })

  it("saves an acknowledged edit with unknown fields stored as null", async () => {
    const formData = validOpportunityForm()
    formData.set("acknowledge_incomplete_data", "true")
    const { update } = setupUpdateClient()

    await updateOpportunity("opportunity-001", formData)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        revenue_meur: null,
        ebitda_keur: null,
        headcount: null,
        headcount_range: null,
        source_id: null,
        source_label: null,
      }),
    )
  })

  it("allows a legacy opportunity without a public title to be edited", async () => {
    const formData = validOpportunityForm()
    formData.delete("public_title")
    formData.set("acknowledge_incomplete_data", "true")
    const { update } = setupUpdateClient()

    await expect(updateOpportunity("opportunity-001", formData)).resolves.toEqual({
      success: true,
      message: "Opportunity saved.",
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ public_title: null }),
    )
  })

  it("persists confirmed zero values without showing an incomplete-data warning", async () => {
    const formData = validOpportunityForm()
    formData.set("revenue_meur", "0")
    formData.set("ebitda_keur", "0")
    formData.set("headcount_range", "0")
    formData.set("source_firm_name", "Source firm")
    formData.set("source_id", "source-001")
    formData.set("source_contact_ids", "00000000-0000-4000-8000-000000000001")
    const { sourceUpdate, update } = setupUpdateClient()

    await expect(
      updateOpportunity("opportunity-001", formData),
    ).resolves.toEqual({
      success: true,
      message: "Opportunity saved.",
    })

    expect(sourceUpdate).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        revenue_meur: 0,
        ebitda_keur: 0,
        headcount: 0,
        headcount_range: "0",
      }),
    )
  })

  it("does not overwrite legacy activity data when staff save without the removed field", async () => {
    const createForm = validOpportunityForm()
    createForm.set("acknowledge_incomplete_data", "true")
    const { insert } = setupCreateClient()

    await createOpportunity(createForm)

    const createPayload = (insert.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(createPayload).toBeDefined()
    expect(createPayload).not.toHaveProperty("activity")

    const updateForm = validOpportunityForm()
    updateForm.set("acknowledge_incomplete_data", "true")
    const { update } = setupUpdateClient()

    await updateOpportunity("opportunity-001", updateForm)

    const updatePayload = (update.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0]
    expect(updatePayload).toBeDefined()
    expect(updatePayload).not.toHaveProperty("activity")
  })

  it("uses a client submit handler so warning acknowledgement retains uncontrolled values", () => {
    const form = readFileSync(
      `${process.cwd()}/components/opportunities/opportunity-form.tsx`,
      "utf8",
    )

    expect(form).toContain("event.preventDefault()")
    expect(form).toContain("new FormData(event.currentTarget)")
    expect(form).toContain("onSubmit={handleSubmit}")
    expect(form).not.toContain("action={handleSubmit}")
    expect(form).toContain(
      "Incomplete data — this opportunity may not match correctly",
    )
    expect(form).toContain("Save anyway")
    expect(form).toContain('name="acknowledge_incomplete_data"')
    expect(form).toContain('name="public_title"')
    expect(form).toContain('Public title{!opportunity ? " *" : ""}')
    expect(form).toContain("!opportunity &&")
    expect(form).toContain("required={!opportunity}")
    expect(form.indexOf('name="public_title"')).toBeLessThan(
      form.indexOf('name="repreneur_exposure"'),
    )
    expect(form).not.toContain('htmlFor="activity"')
    expect(form).not.toContain('name="activity"')
  })
})
