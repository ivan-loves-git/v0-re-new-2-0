import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = fs.readFileSync(path.join(process.cwd(), "scripts/088_canonical_pursuit_evidence_and_confidentiality.sql"), "utf8")
const nullArtifactGuard = fs.readFileSync(path.join(process.cwd(), "scripts/106_template_validation_null_artifact_guard.sql"), "utf8")

describe("W-090/W-091 evidence foundation", () => {
  it("is append-only, service-only and disabled by default", () => {
    expect(source).toContain("CREATE TABLE IF NOT EXISTS public.opportunity_pursuit_evidence")
    expect(source).toContain("Canonical pursuit evidence is append-only")
    expect(source).toContain("enabled BOOLEAN NOT NULL DEFAULT FALSE")
    expect(source).toContain("REVOKE ALL ON public.opportunity_pursuit_evidence")
    expect(source).toContain("TO service_role")
  })

  it("does not promote legacy NDA fields and uses exact current artifacts", () => {
    expect(source).toContain("Legacy pursuit stages, NDA fields and document visibility are compatibility")
    expect(source).toContain("journey_current_artifact_is_valid")
    expect(source).toContain("Gate 2 requires both current signed copies to be validated")
    expect(source).toContain("opportunity_pursuit_confidential_grants")
  })

  it("rejects a staff template validation when the selected artifact or current template is missing", () => {
    expect(nullArtifactGuard).toContain("p_artifact_id IS NULL OR v_template IS NULL")
    expect(nullArtifactGuard).toContain("exact current blank template")
  })

  it("fails closed for portal access and revokes before terminal changes", () => {
    expect(source).toContain("journey_repreneur_can_access_confidential")
    expect(source).toContain("public.wave_journey_is_enabled()")
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.journey_grant_confidential_access(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated",
    )
    expect(source).toContain("PERFORM public.journey_revoke_confidential_access")
    expect(source).toContain("status='completed'")
  })

  it("resolves the active pursuit's exact Gate-1 template in one canonical operation", () => {
    expect(source).toContain("journey_repreneur_authorized_template")
    expect(source).toContain("match.status='active_pursuit'")
    expect(source).toContain("artifact.id=public.journey_current_template_id(match.id)")
    expect(source).toContain("public.journey_current_gate_1_event(match.id) IS NOT NULL")
    expect(source).toContain(
      "REVOKE ALL ON FUNCTION public.journey_repreneur_authorized_template(UUID,UUID) FROM PUBLIC,anon,authenticated",
    )
  })

  it("binds every confidential release to the latest cycle, exact artifacts, dispatch and expiry", () => {
    expect(source).toContain("journey_current_cycle_event")
    expect(source).toContain("journey_current_gate_1_event")
    expect(source).toContain("journey_current_gate_2_event")
    expect(source).toContain("journey_current_dispatch_event")
    expect(source).toContain("renew_validation_id")
    expect(source).toContain("repreneur_validation_id")
    expect(source).toContain("nda_expires_at>NOW()")
    expect(source).toContain("staff-only PDF Information Memorandum")
    expect(source).toContain("legacy active-pursuit start only; no gate inferred")
  })

  it("retains legacy edits only as read-only history and blocks direct repreneur-copy registration", () => {
    const actions = fs.readFileSync(path.join(process.cwd(), "lib/actions/opportunity-matches.ts"), "utf8")
    const artifacts = fs.readFileSync(path.join(process.cwd(), "lib/actions/opportunity-nda-artifacts.ts"), "utf8")
    expect(actions).toContain("Legacy pursuit-stage editing is read-only")
    expect(actions).toContain("Legacy NDA status editing is read-only")
    expect(artifacts).not.toContain('"repreneur_signed_copy",')
    expect(source).toContain("Repreneur signed copies may be submitted only")
  })
})
