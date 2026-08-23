import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("W-130 staff M&A corrections", () => {
  const migration = source("scripts/113_staff_ma_relationship_corrections.sql")
  const actions = source("lib/actions/ma-relationship-workspaces.ts")
  const ui = source("components/opportunities/ma-relationship-correction-action.tsx")
  const contactsWorkspace = source("components/opportunities/ma-relationship-workspace.tsx")
  const contactsProjection = source("lib/actions/ma-relationships.ts")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")

  it("uses three typed service-only boundaries, never a generic patch", () => {
    expect(migration).toContain("update_ma_firm_correction")
    expect(migration).toContain("update_ma_office_correction")
    expect(migration).toContain("update_ma_contact_correction")
    expect(migration).toContain("GRANT EXECUTE")
    expect(migration).toContain("TO service_role")
    expect(migration).not.toMatch(/jsonb.*patch/i)
    expect(migration).not.toMatch(/^BEGIN;|^COMMIT;$/m)
    expect(migration).not.toContain("p_status")
    expect(migration).not.toContain("p_firm_id_new")
    expect(migration).not.toContain("p_is_default")
    expect(migration).not.toContain("p_region_codes")
    expect(migration).not.toContain("p_campaign_email_suppressed")
    expect(migration).not.toContain("p_source")
    expect(migration).not.toContain("ended_at =")
  })

  it("locks, audits and rejects identity or primary-email violations", () => {
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("updated_by = v_actor")
    expect(migration).toContain("ma_firm_name_already_exists")
    expect(migration).toContain("ma_office_name_already_exists")
    expect(migration).toContain("ma_primary_contact_email_required")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS updated_by TEXT")
    expect(migration).toContain("updated_by = v_actor")
    expect(migration).toContain("opportunity.status IN ('active', 'paused')")
  })

  it("keeps every correction on a staff server action and exposes only approved fields", () => {
    expect(actions).toContain("await requireStaffAccess()")
    expect(actions).toContain('supabase.rpc("update_ma_firm_correction"')
    expect(actions).toContain('supabase.rpc("update_ma_office_correction"')
    expect(actions).toContain('supabase.rpc("update_ma_contact_correction"')
    expect(ui).toContain("This does not move, merge, archive, or disclose any record.")
    expect(ui).not.toContain("status")
    expect(contract).toContain("W-130 staff correction boundary")
  })

  it("lets the canonical contacts workspace choose an exact affiliation for its job title", () => {
    expect(contactsProjection).toContain("affiliations: Array<")
    expect(contactsProjection).toContain("officeLabel")
    expect(contactsWorkspace).toContain("target=\"contact\"")
    expect(ui).toContain("Office affiliation for job title")
    expect(ui).toContain("selectedAffiliationId")
    expect(actions).toContain('revalidatePath("/opportunities/ma/contacts")')
  })
})
