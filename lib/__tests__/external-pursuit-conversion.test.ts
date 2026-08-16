import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireStaffAccess: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@/lib/access-control", () => ({
  requireStaffAccess: mocks.requireStaffAccess,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import {
  convertExternalPursuitToOpportunity,
  preflightExternalPursuitDeletionFulfillment,
} from "@/lib/actions/external-pursuit-conversion"
import { EXTERNAL_PURSUIT_CONVERSION_MOUNT_CONTRACT } from "@/lib/types/external-pursuit-conversion"
import { eligibleExternalPursuitConversionOffices } from "@/lib/utils/external-pursuit-conversion"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/098_external_pursuit_opportunity_conversion.sql")
const externalContract = source("docs/data-models/external-pursuit-data-model-v1.md")
const maContract = source("docs/data-models/ma-advisory-data-model-v1.md")
const panel = source("components/pursuits/external-pursuit-conversion-panel.tsx")
const board = source("components/pursuits/external-pursuit-board.tsx")
const staffPursuitsPage = source("app/(dashboard)/opportunities/pursuits/page.tsx")
const conversionAction = source("lib/actions/external-pursuit-conversion.ts")
const officeIntakeAction = source("lib/actions/opportunity-intake.ts")
const concurrencyRehearsal = source("scripts/rehearse-external-pursuit-conversion-concurrency.sh")

const input = {
  publicTitle: "Regional specialist in industrial services",
  geographyNodeId: "00000000-0000-4092-8000-000000000001",
  sourceOfficeId: "00000000-0000-4000-8000-000000000021",
  primaryAffiliationId: "00000000-0000-4000-8000-000000000022",
}

describe("W-109 External Pursuit conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireStaffAccess.mockResolvedValue({ user: { id: "staff-1" } })
    mocks.rpc.mockResolvedValue({
      data: [{ opportunity_id: "00000000-0000-4000-8000-000000000023", opportunity_reference: "Re-New - FR - 001" }],
      error: null,
      status: 200,
    })
  })

  it("uses a staff-only atomic RPC and sends only fresh canonical inputs", async () => {
    await expect(convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )).resolves.toMatchObject({ success: true, opportunityReference: "Re-New - FR - 001" })

    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith("convert_external_pursuit_to_opportunity", {
      p_dossier_id: "00000000-0000-4000-8000-000000000020",
      p_public_title: input.publicTitle,
      p_geography_node_id: input.geographyNodeId,
      p_source_office_id: input.sourceOfficeId,
      p_primary_affiliation_id: input.primaryAffiliationId,
      p_actor_user_id: "staff-1",
      p_idempotency_key: "00000000-0000-4000-8000-000000000024",
    })
  })

  it("rejects malformed input before access or database work", async () => {
    const result = await convertExternalPursuitToOpportunity("not-a-uuid", {
      ...input,
      publicTitle: "",
    }, "invalid-input-key")
    expect(result.success).toBe(false)
    expect(mocks.requireStaffAccess).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("requires the caller to provide the retry key before access or database work", async () => {
    const result = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "",
    )
    expect(result).toMatchObject({ success: false, message: expect.stringContaining("retry key") })
    expect(mocks.requireStaffAccess).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("reads top-level Supabase status zero as an ambiguous commit outcome", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "", details: "", hint: "", message: "Load failed" },
      status: 0,
    })
    const statusZero = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )
    expect(statusZero).toMatchObject({ success: false, ambiguous: true })
    expect(statusZero.message).not.toContain("Nothing was created")
  })

  it("keeps thrown transport and unknown gateway errors on the exact-retry path", async () => {
    mocks.rpc.mockRejectedValueOnce(new TypeError("fetch failed"))
    const thrown = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )
    expect(thrown).toMatchObject({ success: false, ambiguous: true })

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST002", message: "Could not query the schema cache" },
      status: 503,
    })
    const gateway = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )
    expect(gateway).toMatchObject({ success: false, ambiguous: true })

    mocks.rpc.mockResolvedValueOnce({ data: null, error: null, status: 200 })
    const missingReceipt = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )
    expect(missingReceipt).toMatchObject({ success: false, ambiguous: true })
  })

  it("keeps deterministic database rejection distinct from an ambiguous response", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "external_pursuit_conversion_requires_active_dossier" },
      status: 400,
    })
    const result = await convertExternalPursuitToOpportunity(
      "00000000-0000-4000-8000-000000000020",
      input,
      "00000000-0000-4000-8000-000000000024",
    )
    expect(result).toEqual({
      success: false,
      message: "Only an active, unfinished External Pursuit can be converted.",
    })
  })

  it("exports the staff deletion preflight W-108 must call before storage cleanup", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(preflightExternalPursuitDeletionFulfillment(
      "00000000-0000-4000-8000-000000000020",
    )).resolves.toEqual({ success: true, message: "Deletion fulfillment is ready." })
    expect(mocks.requireStaffAccess).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith(
      "prepare_external_pursuit_deletion_fulfillment",
      {
        p_dossier_id: "00000000-0000-4000-8000-000000000020",
        p_actor_user_id: "staff-1",
      },
    )
  })

  it("fails closed when W-108 cannot confirm the deletion preflight", async () => {
    mocks.rpc.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(preflightExternalPursuitDeletionFulfillment(
      "00000000-0000-4000-8000-000000000020",
    )).resolves.toEqual({
      success: false,
      message: "WAVE could not confirm deletion eligibility. No attachment should be removed.",
    })

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "external_pursuit_already_converted" },
    })
    await expect(preflightExternalPursuitDeletionFulfillment(
      "00000000-0000-4000-8000-000000000020",
    )).resolves.toEqual({
      success: false,
      message: "This dossier is linked to a Re-New opportunity. No attachment was removed.",
    })
  })

  it("excludes synthetic, provisional, inactive and legacy-unknown office options", () => {
    const office = {
      office_id: "office-real",
      firm_id: "firm-real",
      firm_name: "Real Advisory",
      office_name: "Paris",
      office_label: "Real Advisory — Paris",
      firm_status: "active" as const,
      is_default: false,
      is_provisional_source: false,
      contacts: [{
        affiliation_id: "affiliation-real",
        contact_id: "contact-real",
        contact_name: "Named Contact",
        contact_email: null,
      }],
    }
    expect(eligibleExternalPursuitConversionOffices([
      office,
      { ...office, office_id: "office-default", is_default: true },
      { ...office, office_id: "office-acme", is_provisional_source: true },
      { ...office, office_id: "office-prospect", firm_status: "prospect" },
      { ...office, office_id: "office-legacy", is_default: undefined },
      { ...office, office_id: "office-unknown-provisional", is_provisional_source: undefined },
      { ...office, office_id: "office-unnamed", contacts: [{ ...office.contacts[0], contact_name: " " }] },
    ])).toEqual([office])
    expect(officeIntakeAction).toContain("office_is_default")
    expect(officeIntakeAction).toContain("is_default: row.office_is_default")
    expect(officeIntakeAction).toContain("is_provisional_source: row.office_id === provisionalOfficeId")
  })

  it("keeps the UI free of dossier defaults and freezes one exact retry snapshot after ambiguity", () => {
    expect(panel).toContain("const retryRequest = useRef")
    expect(panel).toContain("const submitInFlight = useRef(false)")
    expect(panel).toContain("crypto.randomUUID()")
    expect(panel).toContain("retryRequest.current ?? Object.freeze")
    expect(panel).toContain("input: Object.freeze")
    expect(panel).toContain("request.input,\n        request.key")
    expect(panel).toContain("const fieldsLocked = submitting || ambiguous")
    expect(panel).toContain("Retry exact conversion")
    expect(panel).toContain("staff-only Draft")
    expect(panel).not.toContain("pursuit.title")
    expect(panel).not.toContain("staffInternalNotes")
    expect(panel).not.toContain("sharedNotes")
    expect(conversionAction).not.toContain("Nothing was created")
    expect(conversionAction).toContain("const { data, error, status }")
    expect(conversionAction).toContain("CONVERSION_DOMAIN_ERRORS")
    expect(EXTERNAL_PURSUIT_CONVERSION_MOUNT_CONTRACT).toMatchObject({
      role: "staff-only",
      defaults: expect.stringContaining("start empty"),
      deletion: expect.stringContaining("before any attachment object"),
    })
  })

  it("mounts conversion only from the staff board with server-supplied canonical choices and composes the recovery lock", () => {
    expect(staffPursuitsPage).toContain("listUnconvertedExternalPursuitIds")
    expect(staffPursuitsPage).toContain("listMaOfficeIntakeOptions")
    expect(staffPursuitsPage).toContain("listOpportunityGeographyOptions")
    expect(staffPursuitsPage).toContain("conversionPursuitIds={conversionPursuitIds}")
    expect(board).toContain("managerCanConvert")
    expect(board).toContain('managing.deletionStatus === "active"')
    expect(board).toContain('!["completed", "dropped_archived"].includes(managing.stage)')
    expect(board).toContain("conversionPursuitIds.includes(managing.id)")
    expect(board).toContain("<ExternalPursuitConversionPanel")
    expect(board).toContain("onOperationLockChange={handleManagerOperationLockChange}")
    expect(panel).toContain("conversion:${pursuitId}")
  })

  it("implements immutable one-way conversion and rejects unsafe lifecycle/source paths", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.external_pursuit_opportunity_conversions")
    expect(migration).toContain("REFERENCES public.external_pursuits(id) ON DELETE RESTRICT")
    expect(migration).toContain("REFERENCES public.opportunities(id) ON DELETE RESTRICT")
    expect(migration).toContain("External Pursuit conversion evidence is immutable.")
    expect(migration).toContain("external_pursuit_conversion_requires_active_dossier")
    expect(migration).toContain("source_office.is_default")
    expect(migration).toContain("external_pursuit_conversion_rejects_acme_source")
    expect(migration).toContain("external_pursuit_conversion_requires_active_named_primary_contact")
    expect(migration).toContain("public.create_opportunity_with_office_context")
    expect(migration).toContain("'draft'")
    expect(migration).toContain("external_pursuit_already_converted")
    expect(migration).toContain("assert_external_pursuit_not_converted")
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_dossier_id::TEXT, 0))")
    expect(migration).toContain("prepare_external_pursuit_deletion_fulfillment")
    expect(migration).toContain("PERFORM public.prepare_external_pursuit_deletion_fulfillment(p_dossier_id, actor)")
    expect(migration).toContain("office.is_default AS office_is_default")
    expect(concurrencyRehearsal).toContain("w109-race-staff-a")
    expect(concurrencyRehearsal).toContain("Conversion wins the exact shared lock")
    expect(concurrencyRehearsal).toContain("Deletion request wins the same lock")
    expect(concurrencyRehearsal).toContain("wait_for_advisory_lock")
    expect(concurrencyRehearsal).toContain("external_pursuit_already_converted")
    expect(concurrencyRehearsal).toContain("external_pursuit_conversion_requires_active_dossier")
  })

  it("keeps accepted data, disclosure and deletion rules in both canonical contracts", () => {
    expect(externalContract).toContain("no dossier content, owner, note, contact, file, title, stage or source data is copied")
    expect(externalContract).toContain("The attachment fulfillment path must check this")
    expect(externalContract).toContain("exact submitted snapshot and idempotency key")
    expect(maContract).toContain("W-109 may explicitly convert one eligible External Pursuit")
    expect(maContract).toContain("It never copies the dossier title, owner, stage, availability")
    expect(maContract).toContain("same dossier advisory lock")
  })
})
