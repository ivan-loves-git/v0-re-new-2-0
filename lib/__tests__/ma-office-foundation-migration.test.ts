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
    const affiliationBackfillStart = migration.indexOf(
      "UPDATE public.ma_source_contacts legacy_contact\nSET office_affiliation_id",
    )
    const affiliationBackfill = migration.slice(
      affiliationBackfillStart,
      migration.indexOf(
        "INSERT INTO public.opportunity_ma_contacts",
        affiliationBackfillStart,
      ),
    )

    expect(migration).toContain("one synthetic default office")
    expect(migration).toContain("idx_ma_offices_one_synthetic_default")
    expect(migration).toContain("legacy_link.source_id IS DISTINCT FROM legacy_contact.source_id")
    expect(migration).toContain("idx_ma_contact_office_affiliations_legacy_bridge")
    expect(migration).toContain("contact_email_snapshot")
    expect(migration).toContain("capture_opportunity_ma_contact_snapshot")
    expect(affiliationBackfillStart).toBeGreaterThan(-1)
    expect(affiliationBackfill).toContain(
      "JOIN public.ma_sources source ON source.id = affiliation.legacy_source_id",
    )
    expect(affiliationBackfill).toContain("AND source.id = legacy_contact.source_id")
    expect(affiliationBackfill).not.toContain(
      "JOIN public.ma_sources source ON source.id = legacy_contact.source_id",
    )
  })

  it("indexes every migration-076 child foreign-key path that needs a full leftmost index", () => {
    for (const index of [
      "idx_ma_offices_firm_id",
      "idx_ma_sources_default_office_id",
      "idx_ma_source_contacts_office_affiliation_id",
      "idx_ma_contact_office_affiliations_contact_id",
      "idx_ma_contact_office_affiliations_legacy_source_contact_id",
      "idx_ma_contact_office_affiliations_legacy_source_id",
      "idx_opportunity_ma_contacts_affiliation_id",
      "idx_opportunity_ma_contacts_legacy_source_contact_id",
    ]) {
      expect(migration).toContain(`CREATE INDEX IF NOT EXISTS ${index}`)
    }

    expect(migration).toContain("ON public.ma_offices (firm_id);")
    expect(migration).toContain("ON public.ma_sources (default_office_id);")
    expect(migration).toContain(
      "ON public.ma_source_contacts (office_affiliation_id);",
    )
    expect(migration).toContain(
      "ON public.ma_contact_office_affiliations (contact_id);",
    )
    expect(migration).toContain(
      "ON public.ma_contact_office_affiliations (legacy_source_contact_id);",
    )
    expect(migration).toContain(
      "ON public.ma_contact_office_affiliations (legacy_source_id);",
    )
    expect(migration).toContain(
      "ON public.opportunity_ma_contacts (affiliation_id);",
    )
    expect(migration).toContain(
      "ON public.opportunity_ma_contacts (legacy_source_contact_id);",
    )
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

  it("keeps canonical identity and intake writes atomic without legacy creation", () => {
    const identityStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_ma_firm_with_default_office",
    )
    const saveStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.save_opportunity_office_context",
    )
    const contactPrimitiveStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_or_affiliate_ma_contact",
    )
    const createStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_opportunity_with_office_context",
    )
    const identityDefinition = migration.slice(identityStart, contactPrimitiveStart)
    const saveDefinition = migration.slice(saveStart, createStart)
    const createDefinition = migration.slice(createStart)

    expect(identityStart).toBeGreaterThan(-1)
    expect(migration).toContain("RETURNS TABLE (")
    for (const field of ["firm_id UUID", "office_id UUID", "contact_id UUID", "affiliation_id UUID"]) {
      expect(migration).toContain(field)
    }
    expect(migration).toContain("ma_real_office_name_required")
    expect(migration).toContain("ma_synthetic_default_office_must_use_firm_name")
    expect(migration).toContain("ma_identity_actor_required")
    expect(identityDefinition).toContain(
      "normalized_firm_name := LOWER(BTRIM(firm_name));",
    )
    expect(identityDefinition).toContain(
      "pg_advisory_xact_lock(hashtextextended(normalized_firm_name, 76061));",
    )
    expect(identityDefinition).toContain(
      "WHERE LOWER(BTRIM(firm.name)) = normalized_firm_name",
    )
    expect(identityDefinition).toContain("ma_firm_name_already_exists")
    expect(identityDefinition.indexOf("ma_firm_name_already_exists")).toBeLessThan(
      identityDefinition.indexOf("INSERT INTO public.ma_firms"),
    )
    expect(identityDefinition).not.toContain("INSERT INTO public.ma_sources")

    expect(saveDefinition).toContain(
      "p_opportunity_fields JSONB DEFAULT '{}'::JSONB",
    )
    expect(createDefinition).toContain(
      "p_opportunity_fields JSONB DEFAULT '{}'::JSONB",
    )
    expect(saveDefinition).not.toContain("INSERT INTO public.ma_sources")
    expect(saveDefinition).not.toContain("source_id =")
    expect(saveDefinition).not.toContain("source_label =")
    expect(saveDefinition).toContain("FROM public.ma_firms")
    expect(saveDefinition).toContain("FOR UPDATE;")
    expect(saveDefinition).toContain("opportunity_intake_fields_contains_forbidden_key")
    expect(saveDefinition).toContain("opportunity_intake_fields_contains_unsupported_key")
    expect(saveDefinition).toContain("opportunity_intake_fields_has_invalid_value_type")
    expect(saveDefinition).toContain(
      "opportunity_office_context_cannot_change_historical_status",
    )
    expect(saveDefinition).toContain("revenue_meur")
    expect(saveDefinition).toContain("teaser_summary")
    expect(migration).toContain(
      "to_regprocedure(\n    'public.save_opportunity_office_context(uuid,uuid,uuid[],uuid,text,public.opportunity_status,text)'",
    )
    expect(migration).toContain(
      "DROP FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT)",
    )
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.save_opportunity_office_context(UUID, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT) FROM PUBLIC, anon, authenticated, service_role",
    )
    expect(migration).toContain(
      "DROP FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT)",
    )
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.create_opportunity_with_office_context(TEXT, UUID, UUID[], UUID, TEXT, public.opportunity_status, TEXT) FROM PUBLIC, anon, authenticated, service_role",
    )
    expect(migration.indexOf("DROP FUNCTION public.save_opportunity_office_context")).toBeLessThan(saveStart)
    expect(migration.indexOf("DROP FUNCTION public.create_opportunity_with_office_context")).toBeLessThan(saveStart)
  })

  it("provides one audited canonical primitive for additional or multi-office contacts", () => {
    const contactPrimitiveStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.create_or_affiliate_ma_contact",
    )
    const saveStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.save_opportunity_office_context",
    )
    const contactPrimitive = migration.slice(contactPrimitiveStart, saveStart)

    expect(contactPrimitiveStart).toBeGreaterThan(-1)
    expect(contactPrimitive).toContain("contact_id UUID")
    expect(contactPrimitive).toContain("affiliation_id UUID")
    expect(contactPrimitive).toContain("p_existing_contact_id UUID DEFAULT NULL")
    expect(contactPrimitive).toContain("p_contact_job_title TEXT DEFAULT NULL")
    expect(contactPrimitive).toContain("ma_contact_affiliation_actor_required")
    expect(contactPrimitive).toContain("ma_contact_affiliation_requires_active_office")
    expect(contactPrimitive).toContain("ma_contact_affiliation_requires_non_archived_firm")
    expect(contactPrimitive).toContain("ma_contact_affiliation_requires_active_contact")
    expect(contactPrimitive).toContain(
      "ma_existing_contact_affiliation_must_not_supply_identity_fields",
    )
    expect(contactPrimitive).toContain("ma_contact_office_affiliation_already_active")
    expect(contactPrimitive).toContain("FOR UPDATE;")
    expect(contactPrimitive).toContain("RETURN QUERY")
    expect(contactPrimitive).not.toContain("public.ma_source_contacts")
  })

  it("guards firm archive and direct synthetic-default selection with deferred invariants", () => {
    const historicalLifecycleExit = migration.indexOf(
      "IF opportunity_row.status IN ('closed', 'archived') THEN",
    )
    const syntheticDefaultGuard = migration.indexOf(
      "the invariant blocks a direct service mutation",
    )

    expect(migration).toContain("ma_firm_archive_requires_resolving_active_opportunities")
    expect(migration).toContain("CREATE CONSTRAINT TRIGGER enforce_ma_firm_active_office_on_firm")
    expect(migration).toContain(
      "opportunities_active_or_paused_requires_source_office",
    )
    expect(syntheticDefaultGuard).toBeGreaterThan(historicalLifecycleExit)
  })

  it("preserves closed and archived attribution without requiring current affiliations", () => {
    const officeConsistencyGuard = migration.indexOf(
      "opportunity_contact_affiliation_office_mismatch",
    )
    const historicalLifecycleExit = migration.indexOf(
      "IF opportunity_row.status IN ('closed', 'archived') THEN",
    )
    const currentAffiliationGuard = migration.indexOf(
      "opportunity_active_contact_affiliation_must_be_active",
    )

    expect(officeConsistencyGuard).toBeGreaterThan(-1)
    expect(historicalLifecycleExit).toBeGreaterThan(officeConsistencyGuard)
    expect(historicalLifecycleExit).toBeLessThan(currentAffiliationGuard)
    expect(contract).toContain(
      "They are not required to keep a currently active affiliation or usable current email.",
    )
  })

  it("keeps browser roles out and grants the service role only the required paths", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("TO service_role;")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.save_opportunity_office_context")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_opportunity_with_office_context")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_ma_firm_with_default_office")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_or_affiliate_ma_contact")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.assert_opportunity_office_context(UUID) TO service_role;")
    expect(migration).toContain("REVOKE DELETE ON TABLE")
  })

  it("records the approved exposure and sourcing exclusions in the contract", () => {
    expect(contract).toContain("W-164 now owns the approved target discovery rule")
    expect(contract).toContain("The database derives compatibility exposure from lifecycle")
    expect(contract).toContain("does not add an opportunity sourcing channel")
    expect(contract).toContain(
      "Migrations 076 to 090 are live and schema-verified",
    )
    expect(contract).toContain(
      "Gate 2 executed the final 076 to 078 sequence on 2026-07-26",
    )
    expect(contract).toContain("Canonical firm and operating-office model live since migration 076")
    expect(contract).toContain("W-061 and migration 076")
    expect(contract).toContain("W-021 manual publication rule is retained only as production history")
    expect(contract).toContain("W-063 staff intake reconciliation")
    expect(contract).toContain("p_opportunity_fields JSONB")
    expect(contract).toContain("Reopening is a separate explicit workflow")
    expect(contract).toContain("Canonical contact-affiliation write boundary")
    expect(contract).toContain("create_or_affiliate_ma_contact")
    expect(migration).toContain("repreneur_exposure = 'staff_only'::public.opportunity_visibility")
    expect(migration).not.toContain("p_repreneur_exposure")
    expect(migration).not.toContain("p_origin_channel")
    expect(migration).toContain("'origin_channel'")
  })
})
