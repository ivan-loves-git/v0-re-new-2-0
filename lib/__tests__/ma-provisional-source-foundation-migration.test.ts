import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-064 provisional Acme source foundation", () => {
  const migration = source("scripts/079_provisional_acme_source_foundation.sql")
  const officeContactFoundation = source(
    "scripts/076_ma_office_identity_and_activation_foundation.sql",
  )
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
  const workflowAction = source("lib/actions/ma-workflows.ts")
  const emailActions = source("lib/actions/emails.ts")
  const manualEmailSurface = source(
    "app/(dashboard)/emails/components/manual-send.tsx",
  )

  it("provisions exactly one real Acme office with the existing Bertrand contact", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_provisional_source_contexts",
    )
    expect(migration).toContain("context_key = 'acme_co_paris'")
    expect(migration).toContain("'Acme Co.'")
    expect(migration).toContain("'Acme Paris'")
    expect(migration).toContain("'Paris'")
    expect(migration).toContain("FALSE,")
    expect(migration).toContain("'bertrand galas'")
    expect(migration).toContain("'bertrand.galas@edu.escp.eu'")
    expect(migration).toContain(
      "ma_provisional_acme_requires_one_bertrand_contact",
    )
    expect(migration).toContain(
      "ma_provisional_acme_requires_one_bertrand_staff_identity",
    )
    expect(migration).toContain("ma_provisional_acme_identity_collision")
    expect(migration).not.toContain("UPDATE public.ma_contacts")
  })

  it("fails closed before the existing external email path can load, send, or log", () => {
    const actionStart = workflowAction.indexOf(
      "export async function sendMaSourceWorkflowEmailPayload",
    )
    const action = workflowAction.slice(actionStart)
    const reviewCheck = action.indexOf(
      '.rpc("ma_opportunity_source_review_required"',
    )
    const reservation = action.indexOf('.rpc("reserve_ma_source_email_send"')
    const contextLoad = action.indexOf("await loadOpportunityContext")
    const reservationRefresh = action.indexOf(
      '.rpc("refresh_ma_source_email_send"',
    )
    const send = action.indexOf("await sendIntermediaryEmail")
    const interactionInsert = action.indexOf(
      '.from("ma_source_interactions").insert',
    )

    expect(actionStart).toBeGreaterThan(-1)
    expect(reviewCheck).toBeGreaterThan(-1)
    expect(action).toContain(
      "sourceReviewError || sourceReviewRequired !== false",
    )
    expect(action).toContain(
      "Email blocked until the provisional Acme source is reviewed and resolved.",
    )
    expect(reservation).toBeGreaterThan(reviewCheck)
    expect(action).toContain('.rpc("release_ma_source_email_send"')
    expect(action).toContain("} finally {")
    expect(reviewCheck).toBeLessThan(contextLoad)
    expect(reservation).toBeLessThan(contextLoad)
    expect(reservationRefresh).toBeGreaterThan(contextLoad)
    expect(reservationRefresh).toBeLessThan(send)
    expect(reviewCheck).toBeLessThan(send)
    expect(reviewCheck).toBeLessThan(interactionInsert)
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.ma_opportunity_source_review_required(UUID) TO service_role;",
    )
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_source_email_send_reservations",
    )
    expect(migration).toContain(
      "ma_provisional_source_change_blocked_during_email_send",
    )
    expect(emailActions).toContain("export async function sendTestEmail")
    expect(emailActions).toContain(
      "Does NOT log to database - for testing only",
    )
    expect(manualEmailSurface).toContain(
      "Test Mode: Emails are sent directly without logging",
    )
    expect(action).not.toContain("sendTestEmail")
  })

  it("uses append-only snapshots rather than a mutable review status", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.ma_provisional_source_review_events",
    )
    for (const field of [
      "prior_source_snapshot JSONB NOT NULL",
      "prior_contact_snapshot JSONB NOT NULL",
      "resulting_source_snapshot JSONB NOT NULL",
      "resulting_contact_snapshot JSONB NOT NULL",
      "related_assignment_id UUID",
    ]) {
      expect(migration).toContain(field)
    }
    expect(migration).toContain(
      "ma_provisional_source_review_events_are_immutable",
    )
    expect(migration).toContain("ma_opportunity_source_review_required")
    expect(migration).not.toContain("source_review_status")
  })

  it("reuses the canonical office-context service for auditable assignment and resolution", () => {
    const assignStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.assign_acme_provisional_source",
    )
    const resolveStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.resolve_acme_provisional_source",
    )
    const assign = migration.slice(assignStart, resolveStart)
    const resolve = migration.slice(resolveStart)

    expect(assignStart).toBeGreaterThan(-1)
    expect(resolveStart).toBeGreaterThan(assignStart)
    expect(assign).toContain("SECURITY DEFINER")
    expect(resolve).toContain("SECURITY DEFINER")
    expect(assign).toContain("FOR UPDATE;")
    expect(resolve).toContain("FOR UPDATE;")
    expect(assign).toContain("public.save_opportunity_office_context")
    expect(resolve).toContain("public.save_opportunity_office_context")
    expect(assign).toContain(
      "hashtextextended('ma-provisional-source-cutover-readiness', 76064)",
    )
    expect(resolve).toContain(
      "public.assert_ma_provisional_source_context_integrity()",
    )
    expect(assign).toContain(
      "ma_provisional_source_assignment_blocked_by_cutover",
    )
    expect(assign).toContain(
      "ma_provisional_source_assignment_supports_draft_active_or_paused_only",
    )
    expect(resolve).toContain(
      "ma_provisional_source_resolution_requires_assignment_evidence",
    )
  })

  it("blocks opportunity terminal states and cutover treatment without blocking pursuit work", () => {
    expect(migration).toContain(
      "ma_provisional_source_review_blocks_opportunity_lifecycle_exit",
    )
    expect(migration).toContain(
      "ma_provisional_source_review_blocks_cutover_treatment",
    )
    expect(migration).toContain(
      "NEW.status IN ('approved', 'activating', 'activated')",
    )
    expect(migration).toContain(
      "CREATE TRIGGER guard_ma_provisional_source_cutover_on_run",
    )
    expect(migration).toContain("BEFORE UPDATE OF status")
    expect(migration).not.toContain("opportunity_pursuits")
  })

  it("protects the fixed identity chain and validates every normalized collision on rerun", () => {
    expect(migration).toContain("hashtextextended('acme co.', 76061)")
    expect(
      migration.indexOf("hashtextextended('acme co.', 76061)"),
    ).toBeLessThan(
      migration.indexOf(
        "hashtextextended('ma-provisional-source-context:acme_co_paris', 76064)",
      ),
    )
    for (const invariant of [
      "ma_provisional_acme_requires_exactly_one_firm",
      "ma_provisional_acme_requires_exactly_one_office",
      "ma_provisional_acme_requires_one_bertrand_contact",
      "ma_provisional_acme_requires_one_bertrand_staff_identity",
      "ma_provisional_source_context_is_immutable",
      "ma_provisional_acme_firm_is_immutable",
      "ma_provisional_acme_office_is_immutable",
      "ma_provisional_bertrand_contact_is_immutable",
      "ma_provisional_bertrand_affiliation_is_immutable",
    ]) {
      expect(migration).toContain(invariant)
    }

    const contactGuardStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.guard_ma_provisional_bertrand_contact_identity",
    )
    const affiliationGuardStart = migration.indexOf(
      "CREATE OR REPLACE FUNCTION public.guard_ma_provisional_bertrand_affiliation_identity",
    )
    const contactGuard = migration.slice(
      contactGuardStart,
      affiliationGuardStart,
    )

    expect(officeContactFoundation).toContain(
      "CREATE TRIGGER normalize_ma_contact_display_name",
    )
    expect(contactGuardStart).toBeGreaterThan(-1)
    expect(affiliationGuardStart).toBeGreaterThan(contactGuardStart)
    expect(contactGuard).toContain("effective_display_name := BTRIM(CONCAT_WS(")
    expect(contactGuard).toContain(
      "LOWER(effective_display_name) = 'bertrand galas'",
    )
    expect(contactGuard).toContain(
      "LOWER(BTRIM(NEW.display_name)) = 'bertrand galas'",
    )
    expect(contactGuard).toContain(
      "effective_display_name IS DISTINCT FROM 'Bertrand Galas'",
    )
    expect(contactGuard).toContain(
      "NEW.display_name IS DISTINCT FROM 'Bertrand Galas'",
    )
  })

  it("keeps the new objects service-role-only and out of repreneur paths", () => {
    expect(migration).toContain(
      "ALTER TABLE public.ma_provisional_source_contexts ENABLE ROW LEVEL SECURITY;",
    )
    expect(migration).toContain(
      "ALTER TABLE public.ma_provisional_source_review_events ENABLE ROW LEVEL SECURITY;",
    )
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE[\s\S]*ma_provisional_source_contexts,[\s\S]*ma_provisional_source_review_events[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).toContain("GRANT SELECT ON TABLE")
    expect(migration).toContain("TO service_role;")
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.assign_acme_provisional_source(UUID, TEXT, TEXT) TO service_role;",
    )
    expect(migration).not.toMatch(/repreneur_(opportunit|email|notification)/i)
    expect(migration).not.toMatch(/send.*email|recipient_email/i)
  })

  it("keeps the implementation and a synthetic-only rehearsal visible in the canonical contract", () => {
    expect(contract).toContain("W-064, provisional source foundation")
    expect(contract).toContain("Migration 079 is the checked-in")
    expect(contract).toContain("W-064 and migration 079")

    const fixture = source(
      "scripts/rehearse-ma-provisional-source-foundation.sql",
    )
    const runner = source(
      "scripts/rehearse-ma-provisional-source-foundation.sh",
    )
    expect(fixture).toContain("W-064 disposable rehearsal passed")
    expect(fixture).toContain("w064_fixture_privilege_assertion_failed")
    expect(fixture).toContain("SET CONSTRAINTS ALL IMMEDIATE")
    expect(fixture).toContain("SET LOCAL ROLE service_role")
    expect(fixture).toContain(
      "CREATE TRIGGER normalize_ma_contact_display_name",
    )
    expect(fixture).toContain(
      "w064_fixture_contact_component_mutation_should_have_failed",
    )
    expect(fixture).toContain(
      "w064_fixture_contact_component_collision_should_have_failed",
    )
    expect(fixture).toContain(
      "w064_fixture_contact_display_mutation_should_have_failed",
    )
    expect(fixture).toContain(
      "w064_fixture_contact_display_collision_should_have_failed",
    )
    expect(runner).toContain("/private/tmp/renew-w064-postgres")
    expect(runner).toContain("expect_collision_failure")
    expect(runner).toContain(
      "Concurrent cutover approval unexpectedly succeeded",
    )
    expect(runner).not.toContain(".env")
  })
})
