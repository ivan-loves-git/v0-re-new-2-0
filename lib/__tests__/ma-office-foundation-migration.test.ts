import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const platformRoot = process.cwd()
const migrationPath = "scripts/076_ma_office_identity_and_activation_foundation.sql"
const contractPath = "docs/data-models/ma-advisory-data-model-v1.md"

function source(relativePath: string) {
  return readFileSync(`${platformRoot}/${relativePath}`, "utf8")
}

describe("M&A operating-office foundation migration", () => {
  const migration = source(migrationPath)
  const contract = source(contractPath)

  it("adds the office-first target model without removing compatibility tables", () => {
    for (const table of [
      "public.ma_firms",
      "public.ma_offices",
      "public.ma_contacts",
      "public.ma_contact_office_affiliations",
      "public.opportunity_ma_contacts",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
    }

    expect(migration).toContain("source_office_id UUID REFERENCES public.ma_offices")
    expect(migration).toContain("legacy_source_id UUID")
    expect(migration).toContain("legacy_source_contact_id UUID")
    expect(migration).not.toContain("DELETE FROM public.ma_sources")
    expect(migration).not.toContain("DROP TABLE public.ma_source_contacts")
    expect(migration).not.toContain("DROP TABLE public.opportunity_source_contacts")
  })

  it("backfills synthetic defaults while preserving historical contact moves", () => {
    expect(migration).toContain("one synthetic default office")
    expect(migration).toContain("idx_ma_offices_one_synthetic_default")
    expect(migration).toContain("legacy_link.source_id IS DISTINCT FROM legacy_contact.source_id")
    expect(migration).toContain("idx_ma_contact_office_affiliations_legacy_bridge")
    expect(migration).toContain("contact_email_snapshot")
    expect(migration).toContain("capture_opportunity_ma_contact_snapshot")
  })

  it("provides one staff-only projection and transactional draft or activation RPCs", () => {
    expect(migration).toContain("staff_ma_office_intake_projection")
    expect(migration).toContain("WITH (security_invoker = true)")
    expect(migration).toContain("save_opportunity_office_context")
    expect(migration).toContain("create_opportunity_with_office_context")
    expect(migration).toContain("IF p_source_office_id IS NULL THEN")
    expect(migration).toContain("opportunity_activation_requires_source_office")
    expect(migration).toContain("opportunity_activation_requires_exactly_one_primary_contact")
    expect(migration).toContain("opportunity_active_contact_affiliation_must_be_active")
    expect(migration).toContain("opportunity_source_office_requires_real_office_selection")
    expect(migration).toContain("NOT office.is_default")
    expect(migration.match(/opportunity_office_context_actor_required/g)).toHaveLength(2)
    expect(migration).toContain("Locks always follow opportunity")
  })

  it("keeps browser roles out and grants the service role only the required paths", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("TO service_role;")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_opportunity_with_office_context")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.assert_opportunity_office_context(UUID) TO service_role;")
  })

  it("records the approved exposure and sourcing exclusions in the contract", () => {
    expect(contract).toContain("retires `opportunities.repreneur_exposure` from the target operating model")
    expect(contract).toContain("does not add an opportunity sourcing channel")
    expect(contract).toContain("Migration 076 is checked in but not yet applied to production")
    expect(contract).toContain("W-061 and migration 076")
    expect(contract).toContain("compatibility firewall")
    expect(migration).toContain("repreneur_exposure = 'staff_only'::public.opportunity_visibility")
    expect(migration).not.toContain("p_repreneur_exposure")
    expect(migration).not.toContain("origin_channel")
  })
})
