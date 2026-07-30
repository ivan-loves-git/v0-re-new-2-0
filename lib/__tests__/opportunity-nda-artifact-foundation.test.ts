import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const root = process.cwd()

function source(relativePath: string) {
  return readFileSync(`${root}/${relativePath}`, "utf8")
}

describe("W-043 canonical NDA artifact foundation", () => {
  const migration = source("scripts/082_opportunity_nda_artifact_foundation.sql")
  const actions = source("lib/actions/opportunity-nda-artifacts.ts")
  const genericDocuments = source("lib/actions/opportunity-documents.ts")
  const manager = source("components/opportunities/opportunity-nda-artifact-manager.tsx")
  const pursuit = source("components/opportunities/opportunity-pursuit-panel.tsx")
  const contract = source("docs/data-models/ma-advisory-data-model-v1.md")
  const verifier = source("scripts/verify-ma-data-model-schema.sql")
  const rehearsal = source("scripts/rehearse-opportunity-nda-artifact-foundation.sql")
  const raceRunner = source("scripts/rehearse-opportunity-nda-artifact-foundation.sh")

  it("stores the three approved roles in distinct opportunity and pursuit scopes", () => {
    for (const role of ["blank_template", "renew_signed_copy", "repreneur_signed_copy"]) {
      expect(migration).toContain(`'${role}'`)
      expect(manager).toContain(`role: "${role}"`)
      expect(contract).toContain(`\`${role}\``)
    }

    expect(migration).toContain("artifact_role = 'blank_template' AND match_id IS NULL")
    expect(migration).toContain("artifact_role IN ('renew_signed_copy', 'repreneur_signed_copy')")
    expect(migration).toContain("Pursuit does not belong to the selected opportunity.")
  })

  it("creates immutable monotonic versions through one narrow service", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.opportunity_nda_artifacts")
    expect(migration).toContain("supersedes_artifact_id UUID UNIQUE")
    expect(migration).toContain("FOR UPDATE;")
    expect(migration).toContain("CREATE FUNCTION public.register_opportunity_nda_artifact")
    expect(migration).toContain("opportunity_nda_artifacts_immutable")
    expect(migration).toContain(
      "opportunity_nda_artifacts_validate_integrity",
    )
    expect(migration).toContain(
      "must supersede the immediately previous version in the same scope and role",
    )
    expect(migration).toContain("opportunity_documents_protect_nda_artifacts")
    expect(migration).toContain("register a new version instead")
    expect(migration).toContain("content_sha256")
    expect(actions).toContain('"register_opportunity_nda_artifact"')
    expect(actions).not.toContain('.from("opportunity_nda_artifacts").insert')
    expect(actions).toContain('createHash("sha256")')
    expect(actions).toContain("p_content_sha256: contentSha256")
    expect(actions).toContain("crypto.randomUUID()")
    expect(actions).toContain("upsert: false")
    expect(actions).not.toContain("p_external_url")
    expect(manager).toContain("Retained version history")
    expect(manager).toContain("Upload one retained PDF file")
    expect(manager).toContain("4 MB")
    expect(actions).toContain("4 * 1024 * 1024")
    expect(manager).not.toContain("external_url")
    expect(manager).not.toContain("Delete")
    expect(manager).not.toContain("Replace")
  })

  it("keeps browser roles out and service writes behind the RPC", () => {
    expect(migration).toContain("ALTER TABLE public.opportunity_nda_artifacts ENABLE ROW LEVEL SECURITY;")
    expect(migration).toContain("ALTER TABLE public.opportunity_nda_artifacts FORCE ROW LEVEL SECURITY;")
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.opportunity_nda_artifacts[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).toContain("GRANT SELECT ON TABLE public.opportunity_nda_artifacts TO service_role;")
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.register_opportunity_nda_artifact\([\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.register_opportunity_nda_artifact\([\s\S]*TO service_role;/,
    )
    expect(actions).toContain("await requireStaffAccess()")
    expect(verifier).toContain("service_artifact_direct_write")
    expect(verifier).toContain("browser_artifact_access")
  })

  it("never promotes legacy status or linked-document evidence", () => {
    const functionStart = migration.indexOf("CREATE FUNCTION public.register_opportunity_nda_artifact")
    const functionBody = migration.slice(functionStart)

    expect(functionBody).not.toContain("nda_status")
    expect(functionBody).not.toContain("nda_document_id")
    expect(migration).not.toContain("INSERT INTO public.opportunity_nda_artifacts\nSELECT")
    expect(rehearsal).toContain("Legacy NDA evidence was promoted into canonical artifacts")
    expect(verifier).toContain("legacy_links_promoted")
    expect(contract).toContain("never become canonical artifact evidence by inference")
  })

  it("does not activate gates, disclosure, memo access, or email delivery", () => {
    for (const forbidden of [
      "triggerOpportunityMemoNotification",
      "sendMaSourceWorkflowEmail",
      "sendIntermediaryEmail",
      "nda_signed_at",
      "nda_waived_at",
      "repreneur_approved_at",
      "source_disclosure",
    ]) {
      expect(actions).not.toContain(forbidden)
    }
    expect(manager).toContain("do not complete")
    expect(manager).toMatch(/disclose the\s+source/)
    expect(pursuit).toContain("Legacy compatibility fields")
    expect(pursuit).toContain("do not")
    expect(contract).toContain(
      "Registering any artifact does not validate signer, opportunity or pursuit validity",
    )
    expect(contract).toContain("pass Gate 1 or Gate 2")
  })

  it("keeps blank NDA recording available while signed-copy controls wait for an active pursuit", () => {
    expect(manager).toContain('const isLockedSignedCopy = requiresPursuit && !activeMatchId')
    expect(manager).toContain("Available when an active pursuit starts")
    expect(manager).toContain("Signed copies belong to a specific pursuit")
    expect(manager).toContain("retained versions from earlier pursuits remain available below")
    expect(manager).toContain("{isLockedSignedCopy ? (")
    expect(manager).toContain('role: "blank_template"')
    expect(manager).toContain('disabled={pendingRole === definition.role}')
    expect(manager).not.toContain("disabled={!canRegister}")
    expect(manager).not.toContain("disabled={!canRegister || pendingRole === definition.role}")
  })

  it("protects canonical documents before generic storage deletion or visibility change", () => {
    const visibilityStart = genericDocuments.indexOf("export async function updateOpportunityDocumentVisibility")
    const removalStart = genericDocuments.indexOf("export async function removeOpportunityDocument")
    const visibilityAction = genericDocuments.slice(visibilityStart, removalStart)
    const removalAction = genericDocuments.slice(removalStart)

    expect(visibilityAction.indexOf("assertDocumentIsNotCanonicalNdaArtifact")).toBeLessThan(
      visibilityAction.indexOf('.from("opportunity_documents")'),
    )
    expect(removalAction.indexOf("assertDocumentIsNotCanonicalNdaArtifact")).toBeLessThan(
      removalAction.indexOf(".storage"),
    )
    expect(genericDocuments).toContain("Canonical NDA artifacts are retained evidence")
  })

  it("reconciles ambiguous RPC errors as success before cleaning up retained bytes", () => {
    const rpcStart = actions.indexOf('supabase.rpc("register_opportunity_nda_artifact"')
    const cleanupStart = actions.indexOf(".remove([storagePath])", rpcStart)
    const reconciliation = actions.slice(rpcStart, cleanupStart)

    expect(reconciliation).toContain('.from("opportunity_documents")')
    expect(reconciliation).toContain('.eq("storage_path", storagePath)')
    expect(reconciliation).toContain('.from("opportunity_nda_artifacts")')
    expect(reconciliation).toContain('.eq("document_id", retainedDocument.id)')
    expect(reconciliation).toContain("artifactId: retainedArtifact.id")
    expect(reconciliation).toContain("versionNumber: retainedArtifact.version_number")
    expect(reconciliation).toContain("reconciliationAttempts = status === 0 ? 4 : 1")
    expect(reconciliation).toContain("status >= 400 && status < 500 && confirmedNoDocument")
    expect(actions).toContain("Refresh before uploading again")
  })

  it("includes a disposable clean-rerun, invalid-boundary, retention, and concurrency proof", () => {
    expect(rehearsal.match(/\\ir 082_opportunity_nda_artifact_foundation\.sql/g)).toHaveLength(2)
    expect(rehearsal).toContain("Pursuit does not belong")
    expect(rehearsal).toContain("requires one active staff identity")
    expect(rehearsal).toContain("require a SHA-256 content digest")
    expect(rehearsal).toContain("must be PDF")
    expect(rehearsal).toContain("storage paths must be unique")
    expect(rehearsal).toContain("retained canonical NDA evidence")
    expect(raceRunner).toContain("immutable-path boundaries")
    expect(raceRunner).toContain('!= "1,2"')
  })
})
