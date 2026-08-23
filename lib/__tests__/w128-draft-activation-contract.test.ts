import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  path.join(process.cwd(), "scripts/115_w128_draft_opportunity_activation.sql"),
  "utf8"
)
const verifyWorkflow = readFileSync(path.join(process.cwd(), ".github/workflows/verify.yml"), "utf8")

describe("W-128 Draft activation contract", () => {
  it("installs a read-only preflight and a separately guarded atomic apply", () => {
    expect(migration).toContain("w128_draft_activation_preflight")
    expect(migration).toContain("apply_w128_draft_activation")
    expect(migration).toContain("JSONB_TYPEOF(p_manifest) <> 'array'")
    expect(migration).toContain("w128_activation_manifest_digest_mismatch")
    expect(migration).toContain("w128_activation_manifest_set_mismatch")
    expect(migration).toContain("w128_activation_already_completed")
    expect(migration).toContain("FULL OUTER JOIN")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("IN SHARE ROW EXCLUSIVE MODE")
    expect(migration).toContain("w128_activation_manifest_drift")
    expect(migration).toContain("FOR UPDATE OF opportunity")
    expect(migration).toContain("FOR UPDATE OF office")
    expect(migration).toContain("FOR UPDATE OF firm")
    expect(migration).toContain("FOR UPDATE OF link")
    expect(migration).toContain("FOR UPDATE OF affiliation")
    expect(migration).toContain("FOR UPDATE OF contact")
    expect(migration).toContain("Lock inactive links too")
    expect(migration).not.toMatch(/WHERE link\.is_active FOR UPDATE OF (link|affiliation|contact)/)
    expect(migration).not.toMatch(/contact_fingerprint, match_count\s*\n\s*\)/)
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

  it("keeps audit writes behind the guarded functions and supports an exact rollback", () => {
    expect(migration).toContain("rollback_w128_draft_activation")
    expect(migration).toContain("w128_draft_activation_rollbacks")
    expect(migration).toContain("w128_rollback_manifest_drift")
    expect(migration).toContain("w128_opportunity_dependency_fingerprint")
    expect(migration).toContain("dependency_fingerprint")
    for (const lifecycleTable of [
      "ma_interactions",
      "ma_interaction_delivery_events",
      "ma_interaction_owner_verification_events",
      "ma_contact_email_policy_events",
      "ma_provisional_source_review_events",
      "ma_source_email_send_reservations",
      "external_pursuit_opportunity_conversions",
      "external_pursuits",
      "external_pursuit_audit_events",
    ]) {
      expect(migration).toContain(lifecycleTable)
    }
    expect(migration).toContain("BEFORE TRUNCATE")
    expect(migration).toContain("REVOKE ALL ON TABLE public.w128_draft_activation_runs FROM PUBLIC, anon, authenticated, service_role")
    expect(migration).toContain("REVOKE ALL ON TABLE public.w128_draft_activation_rollbacks FROM PUBLIC, anon, authenticated, service_role")
    expect(migration).toContain("activation_updated_at")
    expect(migration).toContain("The migration itself performs no activation or rollback")
  })

  it("rehearses the full activation, drift, rollback, and audit path in Verify", () => {
    expect(verifyWorkflow).toContain("Rehearse W-128 Draft activation and rollback")
    expect(verifyWorkflow).toContain('PG_BIN="$(pg_config --bindir)" bash scripts/rehearse-w128-draft-opportunity-activation.sh')
  })
})
