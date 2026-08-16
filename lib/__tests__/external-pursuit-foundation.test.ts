import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8")
const migration = source("scripts/093_external_pursuit_foundation.sql")
const contract = source("docs/data-models/external-pursuit-data-model-v1.md")
const actions = source("lib/actions/external-pursuits.ts")
const rehearsal = source("scripts/rehearse-external-pursuit-foundation.sql")
const privilegeHardening = source("scripts/094_external_pursuit_service_role_privilege_hardening.sql")

describe("W-104/W-105 External Pursuit foundation", () => {
  it("keeps the fixed stage map, availability and due state outside canonical pursuits", () => {
    for (const stage of [
      "identified", "contact_qualification", "information", "meetings",
      "negotiation", "loi", "due_diligence_financing", "completed", "dropped_archived",
    ]) expect(migration).toContain(`'${stage}'`)
    expect(migration).toContain("'available', 'limited', 'unavailable', 'unknown'")
    expect(migration).toContain("due_at DATE")
    expect(contract).toContain("no UI route, outbound notification, email, SMS")
    expect(migration).not.toContain("opportunity_matches")
    expect(migration).not.toContain("opportunity_pursuit")
  })

  it("uses Better Auth user IDs, owner-derived access and server-only mutations", () => {
    expect(migration).toContain("WHERE r.user_id = NULLIF(BTRIM(p_actor_user_id), '')")
    expect(migration).toContain("owner_id <> p.owner_repreneur_id")
    expect(actions).toContain("access.role === \"staff\" ? input.ownerRepreneurId : access.repreneurId")
    expect(actions).toContain("p_actor_user_id: access.user.id")
    expect(actions).toContain("requireStaffAccess()")
    expect(actions).not.toContain('.from("external_pursuits")')
  })

  it("separates owner and staff projections without an API or export path", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.external_pursuit_notes")
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.external_pursuit_staff_notes")
    expect(migration).toContain("IF actor_role='staff' THEN RETURN jsonb_build_object")
    expect(migration).toContain("'staff_internal_notes'")
    expect(migration).toContain("RETURN jsonb_build_object('pursuit'")
    expect(actions).not.toContain("console.error")
    expect(actions).not.toContain("app/api/")
    expect(contract).toContain("Other repreneur or unassigned user reads/writes | Denied")
  })

  it("is append-only, service-role mutation-only and keeps a minimal tombstone", () => {
    expect(migration).toContain("External Pursuit audit is immutable.")
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON public.external_pursuit_audit_events")
    expect(migration).toContain("REVOKE ALL ON TABLE public.external_pursuits")
    expect(migration).toContain("GRANT SELECT ON TABLE")
    expect(privilegeHardening).toContain("REVOKE ALL ON TABLE")
    expect(privilegeHardening).toContain("FROM service_role")
    expect(privilegeHardening).toContain("GRANT SELECT ON TABLE")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_external_pursuit")
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.external_pursuit_deletion_tombstones")
    expect(migration).toContain("DELETE FROM public.external_pursuit_notes")
    expect(migration).toContain("DELETE FROM public.external_pursuit_staff_notes")
    expect(migration).toContain("DELETE FROM public.external_pursuit_contacts")
    expect(migration).toContain("DELETE FROM public.external_pursuit_audit_events")
    expect(migration).toContain("DELETE FROM public.external_pursuits")
    expect(migration).toContain("wave.external_pursuit_delete_purge")
    expect(migration).toContain("No dossier content, row or ordinary audit event is retained")
  })

  it("makes deletion a staff fulfillment and leaves attachment cleanup to W-108", () => {
    expect(actions).toContain("requestExternalPursuitDeletion")
    expect(actions).toContain("fulfillExternalPursuitDeletion")
    expect(actions).toContain("W-108 must remove its private file objects")
    expect(contract).toContain("W-108 extends the")
    expect(contract).toContain("no completion message is allowed")
  })

  it("allows only an owner deletion request and replays mutation keys before writes", () => {
    expect(migration).toContain("Only the owner repreneur may request deletion.")
    expect(migration).toContain("actor_role <> 'repreneur'")
    expect(migration).toContain("event_type='updated' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key")
    expect(migration).toContain("replay->>'contact_id'")
    expect(migration).toContain("event_type='delete_requested' AND a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key")
    expect(migration).toContain("former_dossier_id=p_dossier_id")
  })

  it("scopes idempotency to the actor and owner and never projects its keys", () => {
    expect(migration).toContain("UNIQUE (created_by, owner_repreneur_id, create_idempotency_key)")
    expect(migration).toContain("UNIQUE (external_pursuit_id, event_type, actor_user_id, idempotency_key)")
    expect(migration).toContain("ep.created_by=actor AND ep.owner_repreneur_id=p_owner_repreneur_id")
    expect(migration).toContain("a.actor_user_id=actor AND a.idempotency_key=p_idempotency_key")
    expect(migration).not.toContain("'pursuit',to_jsonb(p)")
    expect(migration).not.toContain("jsonb_agg(to_jsonb(a)")
  })

  it("locks replayable writes and denies owners once deletion is requested", () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0))")
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended(actor || ':' || p_owner_repreneur_id::text")
    expect(migration).toContain("ON CONFLICT (created_by,owner_repreneur_id,create_idempotency_key) DO NOTHING")
    expect(migration).toContain("p.deletion_status <> 'active'")
    expect(rehearsal).toContain("w105_delete_requested_owner_read_was_allowed")
    expect(migration.match(/pg_advisory_xact_lock\(hashtextextended\(p_dossier_id::text, 0\)\)/g)?.length).toBeGreaterThanOrEqual(4)
    expect(migration).toContain("SET search_path = ''")
  })

  it("preserves omitted patch fields and rejects malformed due dates", () => {
    expect(actions).toContain("p_stage_provided: input.stage !== undefined")
    expect(actions).toContain("p_availability_provided: input.availability !== undefined")
    expect(actions).toContain("p_due_at_provided: input.dueAt !== undefined")
    expect(actions).toContain("p_shared_notes_provided: input.sharedNotes !== undefined")
    expect(actions).toContain("input.staffInternalNotes !== undefined")
    expect(actions).not.toContain("Object.hasOwn(input")
    expect(actions).toContain("Due date must use a valid YYYY-MM-DD date.")
    expect(migration).toContain("CASE WHEN p_stage_provided")
    expect(migration).toContain("CASE WHEN p_due_at_provided")
    expect(source("lib/types/external-pursuit.ts")).toContain("retain a generated idempotency key across a network retry")
  })

  it("ships a disposable owner A/owner B/staff database rehearsal", () => {
    expect(rehearsal).toContain("093_external_pursuit_foundation.sql")
    expect(rehearsal).toContain("external-owner-a-user")
    expect(rehearsal).toContain("external-owner-b-user")
    expect(rehearsal).toContain("external-staff-user")
    expect(rehearsal).toContain("w105_projection_boundary_failed")
    expect(rehearsal).toContain("w105_other_owner_read_was_allowed")
    expect(rehearsal).toContain("w105_audit_update_was_allowed")
    expect(rehearsal).toContain("w105_tombstone_or_purge_failed")
  })
})
