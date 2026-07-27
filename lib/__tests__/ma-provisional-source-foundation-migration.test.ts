import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-064 provisional Acme source foundation", () => {
  const migration = source("scripts/079_provisional_acme_source_foundation.sql")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")

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
    expect(assign).toContain("ma_provisional_source_assignment_supports_draft_active_or_paused_only")
    expect(resolve).toContain("ma_provisional_source_resolution_requires_assignment_evidence")
  })

  it("blocks opportunity terminal states and cutover treatment without blocking pursuit work", () => {
    expect(migration).toContain(
      "ma_provisional_source_review_blocks_opportunity_lifecycle_exit",
    )
    expect(migration).toContain(
      "ma_provisional_source_review_blocks_cutover_treatment",
    )
    expect(migration).toContain("NEW.status IN ('approved', 'activating', 'activated')")
    expect(migration).not.toContain("opportunity_pursuits")
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

    const fixture = source("scripts/rehearse-ma-provisional-source-foundation.sql")
    const runner = source("scripts/rehearse-ma-provisional-source-foundation.sh")
    expect(fixture).toContain("W-064 disposable rehearsal passed")
    expect(fixture).toContain("w064_fixture_privilege_assertion_failed")
    expect(runner).toContain("/private/tmp/renew-w064-postgres")
    expect(runner).not.toContain(".env")
  })
})
