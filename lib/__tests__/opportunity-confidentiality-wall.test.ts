import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("opportunity confidentiality wall", () => {
  it("removes direct browser-role access to staff-only opportunity and provenance records", () => {
    const migration = source("scripts/073_confidentiality_wall_and_live_source_invariant.sql")

    for (const table of [
      "public.ma_sources",
      "public.opportunities",
      "public.opportunity_matches",
      "public.opportunity_documents",
      "public.ma_source_interactions",
      "public.opportunity_pursuit_events",
    ]) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`)
      expect(migration).toContain(table)
    }

    expect(migration).toContain("FROM PUBLIC, anon, authenticated;")
    expect(migration).toContain("TO service_role;")
    expect(migration).toContain('DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON storage.objects;')
    expect(migration).toContain('DROP POLICY IF EXISTS "Authenticated users can view ma sources" ON public.ma_sources;')
    expect(migration).toContain('DROP POLICY IF EXISTS "Authenticated users can view opportunity matches" ON public.opportunity_matches;')
  })

  it("keeps repreneur projections behind the Better Auth portal gate and server-side client", () => {
    const portalActions = source("lib/actions/repreneur-opportunities.ts")

    expect(portalActions.indexOf("requirePortalAccess")).toBeLessThan(
      portalActions.indexOf("createAdminClient"),
    )
    expect(portalActions).not.toContain('@/lib/supabase/client')
    expect(portalActions).toContain("safeRepreneurTeaserSummary")
    expect(portalActions).toContain("visible_documents: []")
    expect(portalActions).not.toContain("canAccessOpportunityMemo")
    expect(portalActions).not.toContain("getRepreneurMemoAvailability")
  })

  it("enforces source evidence and never treats legacy metadata as disclosure approval", () => {
    const migration = source("scripts/073_confidentiality_wall_and_live_source_invariant.sql")
    const documentActions = source("lib/actions/opportunity-documents.ts")

    expect(migration).toContain("CHECK (status <> 'active' OR source_id IS NOT NULL)")
    expect(migration).toContain("opportunity_matches_signed_requires_evidence")
    expect(migration).toContain("opportunity_matches_waived_requires_evidence")
    expect(migration).toContain("opportunity_documents_repreneur_approval_evidence")
    expect(migration).toContain("d.repreneur_approved_at IS NOT NULL")
    expect(migration).toContain("om.nda_signed_at IS NOT NULL")
    expect(documentActions).toContain("repreneur_approved_by: user.id")
    expect(documentActions).toContain("Existing records are never silently blessed")
  })

  it("opens signed memo routes as documents instead of app-navigation prefetches", () => {
    const detail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(detail).toContain('<a href={`/portal/deals/${opportunity.match_id}/documents/${journey.confidentialGrant.information_memo_document_id}`}>')
    expect(detail).not.toContain("<Link href=")
  })

  it("does not imply that a legacy not-required label bypasses explicit waiver evidence", () => {
    const detail = source("components/opportunities/repreneur-opportunity-detail.tsx")

    expect(detail).toContain("canonical confidentiality journey")
    expect(detail).not.toContain("NDA marked not required")
  })
})
