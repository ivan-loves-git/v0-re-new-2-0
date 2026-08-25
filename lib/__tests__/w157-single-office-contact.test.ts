import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const source = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("W-157 single current office per contact", () => {
  const migration = source(
    "supabase/migrations/20260825072313_w157_single_office_per_contact.sql",
  )
  const rehearsal = source("scripts/rehearse-w157-single-office-contacts.sh")
  const actions = source("lib/actions/ma-relationship-workspaces.ts")
  const directory = source(
    "components/opportunities/ma-relationship-workspace.tsx",
  )
  const correction = source(
    "components/opportunities/ma-relationship-correction-action.tsx",
  )
  const officeContact = source(
    "components/opportunities/ma-office-contact-action.tsx",
  )
  const sourceContext = source(
    "components/opportunities/opportunity-source-context.tsx",
  )
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")

  it("normalizes deterministically without deleting relationship history", () => {
    expect(migration).toContain("w157_contact_office_winners")
    expect(migration).toContain("live_opportunity_links DESC")
    expect(migration).toContain("central_office_rank DESC")
    expect(migration).toContain("w157-normalization:evidence-first-v1")
    expect(migration).toContain(
      "w157_multi_office_contact_has_live_opportunity_conflict",
    )
    expect(migration).not.toMatch(
      /DELETE\s+FROM\s+public\.ma_contact_office_affiliations/i,
    )
  })

  it("enforces exactly one active office and exposes only the atomic staff move", () => {
    expect(migration).toContain(
      "idx_ma_contact_office_affiliations_one_active_contact",
    )
    expect(migration).toContain("WHERE is_active")
    expect(migration).toContain("DEFERRABLE INITIALLY DEFERRED")
    expect(migration).toContain(
      "ma_active_contact_requires_exactly_one_active_office",
    )
    expect(migration).toContain("ma_contact_already_has_active_office")
    expect(migration).toContain(
      "update_ma_contact_with_office_correction",
    )
    expect(migration).toContain(
      "ma_contact_move_blocked_by_current_opportunity",
    )
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
    expect(migration).toContain("TO service_role")
  })

  it("rehearses selection, history, movement, rollback-on-error and roles", () => {
    for (const assertion of [
      "w157_central_office_preference_failed",
      "w157_active_firm_preference_failed",
      "w157_live_opportunity_preference_failed",
      "w157_old_affiliation_history_failed",
      "w157_direct_second_office_was_allowed",
      "w157_existing_contact_second_office_was_allowed",
      "w157_live_opportunity_move_was_allowed",
      "w157_blocked_move_changed_contact",
      "w157_orphan_active_contact_was_allowed",
      "w157_browser_execute_privilege_leaked",
    ]) {
      expect(rehearsal).toContain(assertion)
    }
  })

  it("makes Contacts the only existing-person placement workflow", () => {
    expect(actions).toContain("update_ma_contact_with_office_correction")
    expect(actions).toContain('correctionField(formData, "office_id")')
    expect(correction).toContain("Current firm and office")
    expect(correction).toContain('formData.set("office_id", selectedOfficeId)')
    expect(directory).toContain("linkedOpportunities")
    expect(directory).toContain("Primary")
    expect(directory).toContain("moveBlocked")
    expect(officeContact).not.toContain("listMaCanonicalContactOptions")
    expect(sourceContext).not.toContain("listMaCanonicalContactOptions")
    expect(officeContact).toContain("move them from Contacts")
    expect(sourceContext).toContain("move them from Contacts")
  })

  it("records the approved cardinality and retained-history contract", () => {
    expect(contract).toContain(
      "Every active contact belongs to exactly one current office.",
    )
    expect(contract).toContain(
      "earlier office affiliations remain historical evidence",
    )
    expect(contract).toContain("W-157 implementation candidate")
  })
})
