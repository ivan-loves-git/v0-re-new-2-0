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
  createMaFirmOfficeContext,
  createMaOfficeForExistingFirm,
  createMaOfficeContact,
  createOpportunityIntake,
  listMaCanonicalContactOptions,
  resolveAcmeProvisionalSource,
  updateOpportunityIntake,
} from "@/lib/actions/opportunity-intake"
import { opportunityIntakeTraceCategory } from "@/lib/utils/opportunity-intake-trace"

const OFFICE_ID = "00000000-0000-4000-8000-000000000001"
const AFFILIATION_ID = "00000000-0000-4000-8000-000000000002"
const EXISTING_CONTACT_ID = "00000000-0000-4000-8000-000000000003"
const SECOND_CONTACT_ID = "00000000-0000-4000-8000-000000000004"
const FRANCE_GEOGRAPHY_ID = "00000000-0000-4092-8000-000000000001"

function activeForm() {
  const formData = new FormData()
  formData.set("reference", "OPP-001")
  formData.set("geography_node_id", FRANCE_GEOGRAPHY_ID)
  formData.set("status", "active")
  formData.set("source_office_id", OFFICE_ID)
  formData.append("affiliation_ids", AFFILIATION_ID)
  formData.set("primary_affiliation_id", AFFILIATION_ID)
  formData.set("description", "A valid internal opportunity record.")
  formData.set("public_title", "An anonymized opportunity title")
  formData.set("teaser_summary", "An anonymized opportunity summary.")
  formData.set("demo_classification", "real")
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

function namedFirmContextForm(field: "contact_first_name" | "contact_last_name") {
  const formData = new FormData()
  formData.set("firm_name", "Acme Conseil")
  formData.set("office_name", "Paris")
  formData.set(field, "Camille")
  return formData
}

function namedOfficeContactForm(
  field: "contact_first_name" | "contact_last_name",
) {
  const formData = new FormData()
  formData.set("contact_mode", "new")
  formData.set(field, "Camille")
  return formData
}

function sourceCorrectionForm() {
  const formData = new FormData()
  formData.set("source_office_id", OFFICE_ID)
  formData.append("affiliation_ids", AFFILIATION_ID)
  formData.set("primary_affiliation_id", AFFILIATION_ID)
  formData.set(
    "source_review_reason",
    "Verified against the intermediary's confirmed office details.",
  )
  return formData
}

describe("canonical opportunity contact persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = "true"
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-001" } })
  })

  it("classifies an allowlisted intake business rule as validation while retaining unknown failures as persistence", () => {
    expect(opportunityIntakeTraceCategory({
      message: "opportunity_activation_requires_source_office",
    }, ["opportunity_activation_requires_source_office"])).toBe("validation_failed")
    expect(opportunityIntakeTraceCategory({
      message: "database connection unexpectedly closed for private@example.test",
    }, ["opportunity_activation_requires_source_office"])).toBe("persistence_failed")
  })

  it("creates through one canonical RPC with office affiliations, never legacy delete/reinsert", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: "opportunity-created", reference: "Re-New - FR - 001" },
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createOpportunityIntake(activeForm())).resolves.toMatchObject({
      success: true,
      opportunityId: "opportunity-created",
    })

    expect(rpc).toHaveBeenCalledWith("create_opportunity_with_office_context_v2", {
      p_reference: "OPP-001",
      p_source_office_id: OFFICE_ID,
      p_affiliation_ids: [AFFILIATION_ID],
      p_primary_affiliation_id: AFFILIATION_ID,
      p_description: "A valid internal opportunity record.",
      p_target_status: "active",
      p_actor: "staff-001",
      p_opportunity_fields: expect.objectContaining({
        geography_node_id: FRANCE_GEOGRAPHY_ID,
        public_title: "An anonymized opportunity title",
        teaser_summary: "An anonymized opportunity summary.",
      }),
    })
  })

  it("preserves a rejected canonical RPC while closing its safe runtime trace", async () => {
    const rawError = new Error(
      "transport failed for opportunity-private-1 staff@example.test",
    )
    const rpc = vi.fn().mockRejectedValue(rawError)
    mocks.createAdminClient.mockReturnValue({ rpc })
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(createOpportunityIntake(activeForm())).rejects.toBe(rawError)

    const events = [...info.mock.calls, ...error.mock.calls].map(([entry]) =>
      JSON.parse(String(entry)),
    ) as Array<Record<string, unknown>>
    expect(events.map((event) => event.stage)).toEqual(["start", "failure"])
    expect(events[1]).toMatchObject({
      operation: "opportunity.create",
      error_category: "persistence_failed",
    })
    expect(JSON.stringify(events)).not.toContain("opportunity-private-1")
    expect(JSON.stringify(events)).not.toContain("staff@example.test")
    info.mockRestore()
    error.mockRestore()
  })

  it("requires staff to choose canonical geography before a new opportunity reaches the database", async () => {
    const formData = activeForm()
    formData.delete("geography_node_id")
    const priorFlag = process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED
    process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = "true"
    try {
      await expect(createOpportunityIntake(formData)).resolves.toMatchObject({
        success: false,
        fieldErrors: {
          geography_node_id:
            "Choose the canonical geography before creating an opportunity.",
        },
      })
      expect(mocks.createAdminClient).not.toHaveBeenCalled()
    } finally {
      if (priorFlag === undefined) delete process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED
      else process.env.WAVE_W039_GEOGRAPHY_MANDATES_ENABLED = priorFlag
    }
  })

  it("returns a field repair when a stale geography selection reaches the controlled service", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "opportunity_geography_not_found" },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createOpportunityIntake(activeForm())).resolves.toMatchObject({
      success: false,
      fieldErrors: {
        geography_node_id: "Choose a current canonical geography.",
      },
    })
  })

  it("does not force a geography onto an existing historical opportunity during an ordinary edit", async () => {
    const formData = activeForm()
    formData.delete("geography_node_id")
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      updateOpportunityIntake("opportunity-001", formData),
    ).resolves.toEqual({ success: true, message: "Opportunity saved." })

    const payload = rpc.mock.calls[0]?.[1] as {
      p_opportunity_fields: Record<string, unknown>
    }
    expect(payload.p_opportunity_fields).not.toHaveProperty("geography_node_id")
  })

  it("omits a month-only source date on an unrelated edit, and exposes no client precision field", async () => {
    const formData = activeForm()
    formData.set("date_added_preserve_month", "true")
    formData.set("date_added_precision", "day")
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      updateOpportunityIntake("opportunity-001", formData),
    ).resolves.toEqual({ success: true, message: "Opportunity saved." })

    const payload = rpc.mock.calls[0]?.[1] as {
      p_opportunity_fields: Record<string, unknown>
    }
    expect(payload.p_opportunity_fields).not.toHaveProperty("date_added")
    expect(payload.p_opportunity_fields).not.toHaveProperty("date_added_precision")
    expect(payload.p_opportunity_fields).not.toHaveProperty("date_added_confirm_day")
  })

  it("sends only a narrow confirmation intent with an explicitly verified day", async () => {
    const formData = activeForm()
    formData.set("date_added_preserve_month", "true")
    formData.set("date_added_confirm_day", "on")
    formData.set("date_added", "2026-01-01")
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await updateOpportunityIntake("opportunity-001", formData)

    const payload = rpc.mock.calls[0]?.[1] as {
      p_opportunity_fields: Record<string, unknown>
    }
    expect(payload.p_opportunity_fields).toMatchObject({
      date_added: "2026-01-01",
      date_added_confirm_day: true,
    })
    expect(payload.p_opportunity_fields).not.toHaveProperty("date_added_precision")
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
      data: { id: "opportunity-created", reference: "Re-New - FR - 001" },
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

  it("maps the migration 076 usable-primary-email error to a staff repair", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: "opportunity_activation_requires_usable_primary_email",
      },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      updateOpportunityIntake("opportunity-001", activeForm()),
    ).resolves.toEqual({
      success: false,
      message:
        "Choose or update a primary contact with a usable email before activating or pausing.",
      fieldErrors: {
        primary_affiliation_id:
          "Choose or update a primary contact with a usable email before activating or pausing.",
      },
    })
  })

  it("resolves a provisional source only through the immutable W-064 correction primitive", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      resolveAcmeProvisionalSource(
        "00000000-0000-4000-8000-000000000099",
        sourceCorrectionForm(),
      ),
    ).resolves.toMatchObject({ success: true })

    expect(rpc).toHaveBeenCalledWith("resolve_acme_provisional_source", {
      p_opportunity_id: "00000000-0000-4000-8000-000000000099",
      p_replacement_office_id: OFFICE_ID,
      p_affiliation_ids: [AFFILIATION_ID],
      p_primary_affiliation_id: AFFILIATION_ID,
      p_actor: "staff-001",
      p_reason: "Verified against the intermediary's confirmed office details.",
    })
  })

  it("rejects incomplete, same-provisional, stale, and terminal source corrections safely", async () => {
    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ rpc })
    await expect(
      resolveAcmeProvisionalSource(
        "00000000-0000-4000-8000-000000000099",
        new FormData(),
      ),
    ).resolves.toMatchObject({
      success: false,
      fieldErrors: {
        source_office_id: expect.any(String),
        affiliation_ids: expect.any(String),
        primary_affiliation_id: expect.any(String),
        source_review_reason: expect.any(String),
      },
    })

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "ma_provisional_source_resolution_requires_real_office",
      },
    })
    await expect(
      resolveAcmeProvisionalSource(
        "00000000-0000-4000-8000-000000000099",
        sourceCorrectionForm(),
      ),
    ).resolves.toMatchObject({
      success: false,
      fieldErrors: { source_office_id: expect.any(String) },
    })

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "ma_provisional_source_resolution_requires_current_acme_source",
      },
    })
    await expect(
      resolveAcmeProvisionalSource(
        "00000000-0000-4000-8000-000000000099",
        sourceCorrectionForm(),
      ),
    ).resolves.toMatchObject({
      success: false,
      message:
        "Source review state changed. Refresh this opportunity and try again.",
    })

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "ma_provisional_source_resolution_supports_draft_active_or_paused_only",
      },
    })
    await expect(
      resolveAcmeProvisionalSource(
        "00000000-0000-4000-8000-000000000099",
        sourceCorrectionForm(),
      ),
    ).resolves.toMatchObject({
      success: false,
      fieldErrors: { status: expect.any(String) },
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

  it("accepts either contact name and rejects a blank new office contact before persistence", async () => {
    for (const field of ["contact_first_name", "contact_last_name"] as const) {
      const rpc = vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: EXISTING_CONTACT_ID,
            affiliation_id: AFFILIATION_ID,
          },
        ],
        error: null,
      })
      mocks.createAdminClient.mockReturnValue({ rpc })

      await expect(
        createMaOfficeContact(OFFICE_ID, namedOfficeContactForm(field)),
      ).resolves.toMatchObject({ success: true })
      expect(rpc).toHaveBeenCalledWith(
        "create_or_affiliate_ma_contact",
        expect.objectContaining({ [`p_${field}`]: "Camille" }),
      )
    }

    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(
      createMaOfficeContact(OFFICE_ID, new FormData()),
    ).resolves.toEqual({
      success: false,
      message: "Add a first name or last name for the contact.",
      fieldErrors: {
        contact_first_name: "Add a first name or last name for the contact.",
        contact_last_name: "Add a first name or last name for the contact.",
      },
    })
    expect(rpc).not.toHaveBeenCalled()
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

      await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual(
        {
          success: false,
          message:
            "Existing canonical contacts cannot be submitted with new identity details.",
        },
      )
    }

    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })

  it("rejects every supplied existing contact ID in new-contact mode", async () => {
    for (const appendExistingContactId of [
      (formData: FormData) =>
        formData.append("existing_contact_id", EXISTING_CONTACT_ID),
      (formData: FormData) =>
        formData.append("existing_contact_id", "not-a-canonical-contact-id"),
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

      await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual(
        {
          success: false,
          message:
            "Choose either an existing canonical contact or a new contact, not both.",
        },
      )
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

      await expect(createMaOfficeContact(OFFICE_ID, formData)).resolves.toEqual(
        {
          success: false,
          message:
            "Choose an active canonical contact to affiliate with this office.",
          fieldErrors: {
            existing_contact_id: "Choose an active canonical contact.",
          },
        },
      )
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

    await expect(createMaFirmOfficeContext(firmContextForm())).resolves.toEqual(
      {
        success: false,
        message: "This firm already exists; select its operating office.",
        fieldErrors: {
          firm_name: "This firm already exists; select its operating office.",
        },
      },
    )

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

  it("returns the committed new-firm context without refreshing away local form state", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          firm_id: "00000000-0000-4000-8000-000000000010",
          office_id: "00000000-0000-4000-8000-000000000011",
          affiliation_id: AFFILIATION_ID,
          contact_id: EXISTING_CONTACT_ID,
        },
      ],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaFirmOfficeContext(firmContextForm())).resolves.toEqual({
      success: true,
      message: "M&A firm, operating office, and first contact created.",
      office: {
        office_id: "00000000-0000-4000-8000-000000000011",
        firm_id: "00000000-0000-4000-8000-000000000010",
        firm_name: "Acme Conseil",
        firm_status: "prospect",
        office_name: "Paris",
        office_label: "Acme Conseil — Paris",
        contacts: [
          {
            affiliation_id: AFFILIATION_ID,
            contact_id: EXISTING_CONTACT_ID,
            contact_name: "Camille Durand",
            contact_email: "camille@example.com",
            job_title: null,
          },
        ],
      },
    })

    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.revalidateOpportunityDashboardTags).not.toHaveBeenCalled()
  })

  it("accepts either first-contact name and rejects a blank new-firm contact before persistence", async () => {
    for (const field of ["contact_first_name", "contact_last_name"] as const) {
      const rpc = vi.fn().mockResolvedValue({
        data: [
          {
            firm_id: "00000000-0000-4000-8000-000000000010",
            office_id: OFFICE_ID,
            affiliation_id: AFFILIATION_ID,
            contact_id: EXISTING_CONTACT_ID,
          },
        ],
        error: null,
      })
      mocks.createAdminClient.mockReturnValue({ rpc })

      await expect(
        createMaFirmOfficeContext(namedFirmContextForm(field)),
      ).resolves.toMatchObject({ success: true })
      expect(rpc).toHaveBeenCalledWith(
        "create_ma_firm_with_default_office",
        expect.objectContaining({ [`p_${field}`]: "Camille" }),
      )
    }

    const rpc = vi.fn()
    mocks.createAdminClient.mockReturnValue({ rpc })

    const formData = new FormData()
    formData.set("firm_name", "Acme Conseil")
    await expect(createMaFirmOfficeContext(formData)).resolves.toEqual({
      success: false,
      message: "Add a first name or last name for the first contact.",
      fieldErrors: {
        contact_first_name:
          "Add a first name or last name for the first contact.",
        contact_last_name:
          "Add a first name or last name for the first contact.",
      },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("adds a real office to an existing active firm through the dedicated atomic service", async () => {
    const formData = new FormData()
    formData.set("existing_firm_id", "00000000-0000-4000-8000-000000000010")
    formData.set("office_name", "Lyon")
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          firm_id: "00000000-0000-4000-8000-000000000010",
          firm_name: "Acme Conseil",
          office_id: "00000000-0000-4000-8000-000000000011",
          office_name: "Lyon",
        },
      ],
      error: null,
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaOfficeForExistingFirm(formData)).resolves.toEqual({
      success: true,
      message: "Operating office added to the existing firm.",
      office: {
        office_id: "00000000-0000-4000-8000-000000000011",
        firm_id: "00000000-0000-4000-8000-000000000010",
        firm_name: "Acme Conseil",
        firm_status: "active",
        office_name: "Lyon",
        office_label: "Acme Conseil — Lyon",
        contacts: [],
      },
    })
    expect(rpc).toHaveBeenCalledWith("create_ma_office_for_existing_firm", {
      p_firm_id: "00000000-0000-4000-8000-000000000010",
      p_office_name: "Lyon",
      p_actor: "staff-001",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.revalidateOpportunityDashboardTags).not.toHaveBeenCalled()
  })

  it("surfaces duplicate office creation without changing form state", async () => {
    const formData = new FormData()
    formData.set("existing_firm_id", "00000000-0000-4000-8000-000000000010")
    formData.set("office_name", "Lyon")
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "ma_real_office_name_already_exists" },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })
    await expect(createMaOfficeForExistingFirm(formData)).resolves.toEqual({
      success: false,
      message: "This firm already has an active real office with that name.",
      fieldErrors: {
        office_name:
          "This firm already has an active real office with that name.",
      },
    })
  })

  it("rejects an archived or inactive firm returned by the atomic office service", async () => {
    const formData = new FormData()
    formData.set("existing_firm_id", "00000000-0000-4000-8000-000000000010")
    formData.set("office_name", "Lyon")
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "ma_existing_firm_not_active" },
    })
    mocks.createAdminClient.mockReturnValue({ rpc })

    await expect(createMaOfficeForExistingFirm(formData)).resolves.toEqual({
      success: false,
      message:
        "This firm is no longer active. Refresh and choose another firm.",
      fieldErrors: {
        existing_firm_id:
          "This firm is no longer active. Refresh and choose another firm.",
      },
    })
  })
})
