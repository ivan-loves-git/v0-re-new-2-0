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
  createMaFirmOfficeContext,
  createMaOfficeContact,
  createOpportunityIntake,
  listMaCanonicalContactOptions,
  updateOpportunityIntake,
} from "@/lib/actions/opportunity-intake"

const OFFICE_ID = "00000000-0000-4000-8000-000000000001"
const AFFILIATION_ID = "00000000-0000-4000-8000-000000000002"
const EXISTING_CONTACT_ID = "00000000-0000-4000-8000-000000000003"
const SECOND_CONTACT_ID = "00000000-0000-4000-8000-000000000004"

function activeForm() {
  const formData = new FormData()
  formData.set("reference", "OPP-001")
  formData.set("status", "active")
  formData.set("source_office_id", OFFICE_ID)
  formData.append("affiliation_ids", AFFILIATION_ID)
  formData.set("primary_affiliation_id", AFFILIATION_ID)
  formData.set("description", "A valid internal opportunity record.")
  formData.set("public_title", "An anonymized opportunity title")
  formData.set("teaser_summary", "An anonymized opportunity summary.")
  return formData
}

function firmContextForm() {
  const formData = new FormData()
  formData.set("firm_name", "Acme Conseil")
  formData.set("office_name", "Paris")
  formData.set("contact_first_name", "Camille")
  formData.set("contact_last_name", "Durand")
  formData.set("contact_email", "camille@example.com")
  return formData
}

describe("canonical opportunity contact persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  it("creates through one canonical RPC with office affiliations, never legacy delete/reinsert", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "opportunity-created" },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createOpportunityIntake(activeForm())).resolves.toBeUndefined()

    expect(rpc).toHaveBeenCalledWith("create_opportunity_with_office_context", {
      p_reference: "OPP-001",
      p_source_office_id: OFFICE_ID,
      p_affiliation_ids: [AFFILIATION_ID],
      p_primary_affiliation_id: AFFILIATION_ID,
      p_description: "A valid internal opportunity record.",
      p_target_status: "active",
      p_actor: "staff-001",
      p_opportunity_fields: expect.objectContaining({
        public_title: "An anonymized opportunity title",
        teaser_summary: "An anonymized opportunity summary.",
      }),
    })
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/opportunities/opportunity-created",
    )
  })

  it("saves an edit through the canonical office-context RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      updateOpportunityIntake("opportunity-001", activeForm()),
    ).resolves.toEqual({ success: true, message: "Opportunity saved." })

    expect(rpc).toHaveBeenCalledWith("save_opportunity_office_context", {
      p_opportunity_id: "opportunity-001",
      p_source_office_id: OFFICE_ID,
      p_affiliation_ids: [AFFILIATION_ID],
      p_primary_affiliation_id: AFFILIATION_ID,
      p_description: "A valid internal opportunity record.",
      p_target_status: "active",
      p_actor: "staff-001",
      p_opportunity_fields: expect.any(Object),
    })
  })

  it("keeps forged portal exposure and origin inputs outside the RPC payload", async () => {
    const formData = activeForm()
    formData.set("repreneur_exposure", "repreneur_visible")
    formData.set("origin_channel", "forged")
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "opportunity-created" },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await createOpportunityIntake(formData)

    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).not.toHaveProperty("p_repreneur_exposure")
    expect(payload).not.toHaveProperty("p_origin_channel")
    expect(payload.p_opportunity_fields).not.toHaveProperty(
      "repreneur_exposure",
    )
    expect(payload.p_opportunity_fields).not.toHaveProperty("origin_channel")
  })

  it("maps canonical activation errors to the field staff can repair", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "opportunity_activation_requires_primary_contact_email",
      },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      updateOpportunityIntake("opportunity-001", activeForm()),
    ).resolves.toEqual({
      success: false,
      message:
        "The primary contact needs a usable email before activation or pause.",
      fieldErrors: {
        primary_affiliation_id:
          "The primary contact needs a usable email before activation or pause.",
      },
    })
  })

  it("adds a second contact through the canonical office-affiliation RPC", async () => {
    const formData = new FormData()
    formData.set("contact_first_name", "Camille")
    formData.set("contact_last_name", "Durand")
    formData.set("contact_email", "camille@example.com")
    formData.set("contact_job_title", "Partner")
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          contact_id: "00000000-0000-4000-8000-000000000003",
          affiliation_id: "00000000-0000-4000-8000-000000000004",
        },
      ],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual({
      success: true,
      message: "Office contact added.",
      contact: {
        contact_id: "00000000-0000-4000-8000-000000000003",
        affiliation_id: "00000000-0000-4000-8000-000000000004",
        contact_name: "Camille Durand",
        contact_email: "camille@example.com",
        job_title: "Partner",
      },
    })

    expect(rpc).toHaveBeenCalledWith("create_or_affiliate_ma_contact", {
      p_office_id: OFFICE_ID,
      p_existing_contact_id: null,
      p_contact_first_name: "Camille",
      p_contact_last_name: "Durand",
      p_contact_email: "camille@example.com",
      p_contact_phone: null,
      p_contact_job_title: "Partner",
      p_actor: "staff-001",
    })
  })

  it("affiliates an existing canonical contact without forwarding identity fields", async () => {
    const formData = new FormData()
    formData.set("contact_mode", "existing")
    formData.set("existing_contact_id", EXISTING_CONTACT_ID)
    formData.set("contact_job_title", "Partner")
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          contact_id: EXISTING_CONTACT_ID,
          affiliation_id: "00000000-0000-4000-8000-000000000004",
        },
      ],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual({
      success: true,
      message: "Office contact added.",
      contact: {
        contact_id: EXISTING_CONTACT_ID,
        affiliation_id: "00000000-0000-4000-8000-000000000004",
        contact_name: null,
        contact_email: null,
        job_title: "Partner",
      },
    })

    expect(rpc).toHaveBeenCalledWith("create_or_affiliate_ma_contact", {
      p_office_id: OFFICE_ID,
      p_existing_contact_id: EXISTING_CONTACT_ID,
      p_contact_job_title: "Partner",
      p_actor: "staff-001",
    })
    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).not.toHaveProperty("p_contact_first_name")
    expect(payload).not.toHaveProperty("p_contact_last_name")
    expect(payload).not.toHaveProperty("p_contact_email")
    expect(payload).not.toHaveProperty("p_contact_phone")
  })

  it("rejects repeated identity fields alongside an existing canonical contact", async () => {
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ rpc })

    for (const field of [
      "contact_first_name",
      "contact_last_name",
      "contact_email",
      "contact_phone",
    ]) {
      const formData = new FormData()
      formData.set("contact_mode", "existing")
      formData.set("existing_contact_id", EXISTING_CONTACT_ID)
      formData.append(field, "")
      formData.append(field, "Forged")

      await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual({
        success: false,
        message:
          "Existing canonical contacts cannot be submitted with new identity details.",
      })
    }

    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects every supplied existing contact ID in new-contact mode", async () => {
    for (const appendExistingContactId of [
      (formData: FormData) =>
        formData.append("existing_contact_id", EXISTING_CONTACT_ID),
      (formData: FormData) =>
        formData.append(
          "existing_contact_id",
          "not-a-canonical-contact-id",
        ),
      (formData: FormData) => {
        formData.append("existing_contact_id", "")
        formData.append("existing_contact_id", EXISTING_CONTACT_ID)
      },
      (formData: FormData) =>
        formData.append("existing_contact_id", new Blob(["forged"])),
    ]) {
      const formData = new FormData()
      formData.set("contact_mode", "new")
      appendExistingContactId(formData)
      formData.set("contact_first_name", "Camille")

      await expect(
        createMaOfficeContact(OFFICE_ID, formData),
      ).resolves.toEqual({
        success: false,
        message:
          "Choose either an existing canonical contact or a new contact, not both.",
      })
    }

    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects repeated or ambiguous canonical contact IDs in existing mode", async () => {
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ rpc })

    for (const appendExistingContactIds of [
      (formData: FormData) => {
        formData.append("existing_contact_id", EXISTING_CONTACT_ID)
        formData.append("existing_contact_id", EXISTING_CONTACT_ID)
      },
      (formData: FormData) => {
        formData.append("existing_contact_id", "")
        formData.append("existing_contact_id", EXISTING_CONTACT_ID)
      },
      (formData: FormData) => {
        formData.append("existing_contact_id", EXISTING_CONTACT_ID)
        formData.append("existing_contact_id", SECOND_CONTACT_ID)
      },
      (formData: FormData) =>
        formData.append("existing_contact_id", new Blob(["forged"])),
    ]) {
      const formData = new FormData()
      formData.set("contact_mode", "existing")
      appendExistingContactIds(formData)

      await expect(
        createMaOfficeContact(OFFICE_ID, formData),
      ).resolves.toEqual({
        success: false,
        message: "Choose an active canonical contact to affiliate with this office.",
      })
    }

    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("lists only active canonical people through a staff-authorized action", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: EXISTING_CONTACT_ID,
          display_name: "Camille Durand",
          email: "camille@example.com",
        },
      ],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    mocks.createAdminClient.mockReturnValue({ from })

    await expect(listMaCanonicalContactOptions()).resolves.toEqual([
      {
        contact_id: EXISTING_CONTACT_ID,
        contact_name: "Camille Durand",
        contact_email: "camille@example.com",
      },
    ])

    expect(mocks.requireStaffAccess).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith("ma_contacts")
    expect(select).toHaveBeenCalledWith("id, display_name, email")
    expect(eq).toHaveBeenCalledWith("status", "active")
    expect(order).toHaveBeenCalledWith("display_name")
  })

  it("maps duplicate firm creation to a select-existing-office instruction", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "ma_firm_name_already_exists" },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaFirmOfficeContext(firmContextForm())).resolves.toEqual({
      success: false,
      message: "This firm already exists; select its operating office.",
      fieldErrors: {
        firm_name: "This firm already exists; select its operating office.",
      },
    })

    expect(rpc).toHaveBeenCalledWith("create_ma_firm_with_default_office", {
      p_firm_name: "Acme Conseil",
      p_contact_first_name: "Camille",
      p_contact_last_name: "Durand",
      p_office_name: "Paris",
      p_is_synthetic_default: false,
      p_contact_email: "camille@example.com",
      p_contact_phone: null,
      p_contact_job_title: null,
      p_actor: "staff-001",
    })
  })
})
