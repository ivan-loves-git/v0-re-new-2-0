import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")

describe("W-170 unused retained-document correction", () => {
  const migration = source("scripts/117_remove_unused_retained_opportunity_documents.sql")
  const rehearsal = source("scripts/rehearse-w170-unused-retained-documents.sql")
  const actions = source("lib/actions/opportunity-documents.ts")
  const documentsPanel = source("components/opportunities/opportunity-documents-panel.tsx")
  const ndaManager = source("components/opportunities/opportunity-nda-artifact-manager.tsx")
  const pursuitPanel = source("components/opportunities/opportunity-pursuit-panel.tsx")
  const detailPage = source("app/(dashboard)/opportunities/[id]/page.tsx")

  it("exposes one staff-only removal seam backed by the guarded RPC", () => {
    expect(actions).toContain("removeUnusedRetainedOpportunityDocument")
    expect(actions).toContain('supabase.rpc("remove_unused_retained_opportunity_document"')
    expect(actions).toContain("await requireStaffAccess()")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.remove_unused_retained_opportunity_document")
    expect(migration).toContain("FOR UPDATE")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.remove_unused_retained_opportunity_document")
  })

  it("permits only unused IMs or latest canonical NDA versions and retains source teasers", () => {
    expect(migration).toContain("v_document.document_type = 'deal_book'")
    expect(migration).toContain("v_document.document_type = 'source_teaser'")
    expect(migration).toContain("Source teasers are permanently retained")
    expect(migration).toContain("later retained version")
    expect(migration).toContain("opportunity_pursuit_confidential_grants")
    expect(migration).toContain("opportunity_pursuit_evidence")
    expect(migration).toContain("nda_document_id")
  })

  it("keeps a retryable private cleanup receipt instead of a broken live reference", () => {
    expect(migration).toContain("opportunity_document_storage_cleanup_receipts")
    expect(migration).toContain("storage_bucket")
    expect(migration).toContain("storage_path")
    expect(actions).toContain("Storage cleanup is still pending")
    expect(actions).toContain(".from(cleanup.storage_bucket).remove([cleanup.storage_path])")
    expect(actions).toContain("complete_unused_retained_opportunity_document_cleanup")
    expect(actions).toContain("listPendingUnusedRetainedDocumentCleanups")
    expect(documentsPanel).toContain("Pending private cleanup")
    expect(detailPage).toContain("listPendingUnusedRetainedDocumentCleanups")
  })

  it("binds eligible private objects to their exact opportunity and NDA role folders", () => {
    expect(migration).toContain("v_document.storage_bucket <> 'opportunity-documents'")
    expect(migration).toContain("p_opportunity_id::TEXT || '/%'")
    expect(migration).toContain("'/nda-artifacts/' || v_artifact.artifact_role::TEXT || '/%'")
    expect(rehearsal).toContain("wrong bucket")
    expect(rehearsal).toContain("cross-opportunity path")
    expect(rehearsal).toContain("wrong NDA role path")
  })

  it("offers removal only through the conditional staff document rows with confirmation", () => {
    expect(documentsPanel).toContain("removeUnusedRetainedOpportunityDocument")
    expect(documentsPanel).toContain("Remove this unused Information Memorandum")
    expect(ndaManager).toContain("removeUnusedRetainedOpportunityDocument")
    expect(ndaManager).toContain("Remove this unused NDA version")
    expect(documentsPanel).toContain('document.can_remove_unused_retained === true')
    expect(ndaManager).toContain('artifact.can_remove_unused_retained === true')
    expect(ndaManager).toContain("Locked after use or supersession")
    expect(pursuitPanel).toContain("artifact.artifact_role === \"repreneur_signed_copy\"")
    expect(pursuitPanel).toContain("artifact.can_remove_unused_retained ? \"available\" : \"locked\"")
    expect(pursuitPanel).toContain("ndaArtifacts.filter((artifact) => artifact.artifact_role === \"repreneur_signed_copy\")")
  })

  it("rehearses success, current-version fallback, and fail-closed boundaries", () => {
    expect(rehearsal).toContain("117_remove_unused_retained_opportunity_documents.sql")
    expect(rehearsal).toContain("Unused IM")
    expect(rehearsal).toContain("prior retained version")
    expect(rehearsal).toContain("cross-opportunity")
    expect(rehearsal).toContain("source teaser")
    expect(rehearsal).toContain("used IM")
    expect(rehearsal).toContain("superseded")
  })
})
