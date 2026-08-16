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

import { convertExternalPursuitToOpportunity } from "@/lib/actions/external-pursuit-conversion"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/098_external_pursuit_opportunity_conversion.sql")
const externalContract = source("docs/data-models/external-pursuit-data-model-v1.md")
const maContract = source("docs/data-models/ma-advisory-data-model-v1.md")
const panel = source("components/pursuits/external-pursuit-conversion-panel.tsx")
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
    })
    expect(result.success).toBe(false)
    expect(mocks.requireStaffAccess).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("keeps the UI free of dossier-derived defaults and retains one retry key", () => {
    expect(panel).toContain("const [requestKey, setRequestKey]")
    expect(panel).toContain("crypto.randomUUID()")
    expect(panel).toContain("staff-only Draft")
    expect(panel).not.toContain("pursuit.title")
    expect(panel).not.toContain("staffInternalNotes")
    expect(panel).not.toContain("sharedNotes")
  })

  it("implements immutable one-way conversion and rejects unsafe lifecycle/source paths", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.external_pursuit_opportunity_conversions")
    expect(migration).toContain("REFERENCES public.external_pursuits(id) ON DELETE RESTRICT")
    expect(migration).toContain("REFERENCES public.opportunities(id) ON DELETE RESTRICT")
    expect(migration).toContain("External Pursuit conversion evidence is immutable.")
    expect(migration).toContain("external_pursuit_conversion_requires_active_dossier")
    expect(migration).toContain("external_pursuit_conversion_rejects_acme_source")
    expect(migration).toContain("external_pursuit_conversion_requires_active_named_primary_contact")
    expect(migration).toContain("public.create_opportunity_with_office_context")
    expect(migration).toContain("'draft'")
    expect(migration).toContain("external_pursuit_already_converted")
    expect(migration).toContain("assert_external_pursuit_not_converted")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(concurrencyRehearsal).toContain("w109-race-staff-a")
    expect(concurrencyRehearsal).toContain("external_pursuit_already_converted")
  })

  it("keeps accepted data, disclosure and deletion rules in both canonical contracts", () => {
    expect(externalContract).toContain("no dossier content, owner, note, contact, file, title, stage or source data is copied")
    expect(externalContract).toContain("The attachment fulfillment path must check this")
    expect(maContract).toContain("W-109 may explicitly convert one eligible External Pursuit")
    expect(maContract).toContain("It never copies the dossier title, owner, stage, availability")
  })
})
