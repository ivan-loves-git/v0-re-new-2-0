import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  path.join(process.cwd(), "scripts/113_w128_draft_opportunity_activation.sql"),
  "utf8"
)

describe("W-128 Draft activation contract", () => {
  it("installs a read-only preflight and a separately guarded atomic apply", () => {
    expect(migration).toContain("w128_draft_activation_preflight")
    expect(migration).toContain("apply_w128_draft_activation")
    expect(migration).toContain("JSONB_TYPEOF(p_manifest) <> 'array'")
    expect(migration).toContain("w128_activation_manifest_digest_mismatch")
    expect(migration).toContain("w128_activation_manifest_drift")
    expect(migration).toContain("FOR UPDATE OF opportunity")
    expect(migration).toContain("FOR UPDATE OF office")
    expect(migration).toContain("FOR UPDATE OF firm")
    expect(migration).toContain("FOR UPDATE OF link")
    expect(migration).toContain("FOR UPDATE OF affiliation")
    expect(migration).toContain("FOR UPDATE OF contact")
  })

  it("uses the released Active contract rather than label or title heuristics", () => {
    expect(migration).toContain("opportunity.is_demo")
    expect(migration).toContain("source_office_inactive_or_missing")
    expect(migration).toContain("source_firm_archived_or_missing")
    expect(migration).toContain("active_contact_invalid_or_wrong_office")
    expect(migration).toContain("primary_contact_not_exactly_one")
    expect(migration).toContain("primary_email_unusable")
    expect(migration).not.toMatch(/ILIKE\s+['\"]%test/i)
    expect(migration).not.toMatch(/ILIKE\s+['\"]%demo/i)
  })

  it("preserves disclosure and relationship state and records a rollback manifest", () => {
    expect(migration).toContain("SET status = 'active', updated_by = v_actor")
    expect(migration).toContain("rollback_manifest")
    expect(migration).toContain("w128_draft_activation_runs_are_immutable")
    expect(migration).toContain("repreneur_exposure")
    expect(migration).toContain("source_visibility")
    expect(migration).not.toContain("UPDATE public.opportunity_matches")
    expect(migration).not.toContain("UPDATE public.opportunity_documents")
  })
})
