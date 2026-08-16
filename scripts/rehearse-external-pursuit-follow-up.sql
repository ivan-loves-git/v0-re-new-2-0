-- Disposable W-107 rehearsal. Run only against a temporary Supabase database.
\set ON_ERROR_STOP on
\ir 093_external_pursuit_foundation.sql
\ir 094_external_pursuit_service_role_privilege_hardening.sql
\ir 095_external_pursuit_board.sql
\ir 096_external_pursuit_follow_up.sql

BEGIN;
INSERT INTO public.repreneurs (id,first_name,last_name,email)
VALUES
  ('00000000-0000-4000-8000-000000010471','Follow-up','Owner','follow-up-owner@example.test'),
  ('00000000-0000-4000-8000-000000010472','Other','Owner','follow-up-other@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_user_roles (user_id,email,role,repreneur_id)
VALUES
  ('follow-up-owner-user','follow-up-owner@example.test','repreneur','00000000-0000-4000-8000-000000010471'),
  ('follow-up-other-user','follow-up-other@example.test','repreneur','00000000-0000-4000-8000-000000010472'),
  ('follow-up-staff-user','follow-up-staff@example.test','staff',NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  dossier UUID;
  owner_view JSONB;
  staff_view JSONB;
  owner_board JSONB;
  staff_board JSONB;
  updated_at_before TIMESTAMPTZ;
  updated_at_after TIMESTAMPTZ;
  audit_metadata JSONB;
  replay_updated_at TIMESTAMPTZ;
  replay_audit_count INTEGER;
BEGIN
  dossier := public.create_external_pursuit_v2(
    '00000000-0000-4000-8000-000000010471', 'Follow-up fixture', 'identified',
    'unknown', NULL, 'Owner-visible seed', 'Staff-only seed',
    'https://example.test/dossier', 'Target company', 'Introducer', 12.5, 1.2, 34,
    'follow-up-staff-user', 'follow-up-create'
  );
  SELECT updated_at INTO updated_at_before FROM public.external_pursuits WHERE id = dossier;
  PERFORM public.update_external_pursuit_follow_up(
    dossier, 'Request refreshed information', TRUE, 'staff', TRUE,
    'limited', TRUE, (CURRENT_DATE + 1), TRUE, 'Shared follow-up note', TRUE,
    'Staff-only follow-up note', TRUE, 'follow-up-staff-user', 'follow-up-save'
  );
  SELECT updated_at INTO updated_at_after FROM public.external_pursuits WHERE id = dossier;
  IF updated_at_after <= updated_at_before THEN RAISE EXCEPTION 'w107_update_timestamp_missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.external_pursuits
    WHERE id = dossier AND next_action = 'Request refreshed information'
      AND responsible_party = 'staff' AND availability = 'limited' AND due_at = CURRENT_DATE + 1
  ) THEN RAISE EXCEPTION 'w107_follow_up_fields_not_saved'; END IF;
  SELECT metadata INTO audit_metadata FROM public.external_pursuit_audit_events
  WHERE external_pursuit_id = dossier AND actor_user_id = 'follow-up-staff-user'
    AND idempotency_key = 'follow-up-save' AND event_type = 'updated';
  IF audit_metadata IS NULL OR audit_metadata::TEXT LIKE '%Request refreshed information%'
    OR audit_metadata::TEXT LIKE '%Staff-only follow-up note%'
    OR NOT (audit_metadata ? 'next_action_changed') THEN
    RAISE EXCEPTION 'w107_content_free_audit_failed';
  END IF;
  -- A response can be lost after commit. The same actor/key must return
  -- without applying a changed replay payload or appending another event.
  SELECT updated_at INTO replay_updated_at FROM public.external_pursuits WHERE id = dossier;
  SELECT count(*) INTO replay_audit_count FROM public.external_pursuit_audit_events
    WHERE external_pursuit_id = dossier AND actor_user_id = 'follow-up-staff-user'
      AND idempotency_key = 'follow-up-save' AND event_type = 'updated';
  PERFORM public.update_external_pursuit_follow_up(
    dossier, 'Changed replay must be ignored', TRUE, 'owner', TRUE,
    'unavailable', TRUE, (CURRENT_DATE + 9), TRUE, 'Changed replay', TRUE,
    'Changed staff replay', TRUE, 'follow-up-staff-user', 'follow-up-save'
  );
  IF (SELECT updated_at FROM public.external_pursuits WHERE id = dossier) <> replay_updated_at
    OR (SELECT count(*) FROM public.external_pursuit_audit_events
        WHERE external_pursuit_id = dossier AND actor_user_id = 'follow-up-staff-user'
          AND idempotency_key = 'follow-up-save' AND event_type = 'updated') <> replay_audit_count
    OR (SELECT next_action FROM public.external_pursuits WHERE id = dossier) <> 'Request refreshed information' THEN
    RAISE EXCEPTION 'w107_lost_response_retry_failed';
  END IF;

  -- Staff changes availability after the owner loaded the form. The owner's
  -- later shared-note-only patch must not restore that stale availability.
  PERFORM public.update_external_pursuit_follow_up(
    dossier, NULL, FALSE, NULL, FALSE, 'available', TRUE, NULL, FALSE,
    NULL, FALSE, NULL, FALSE, 'follow-up-staff-user', 'follow-up-availability'
  );
  PERFORM public.update_external_pursuit_follow_up(
    dossier, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE,
    'Owner added context', TRUE, NULL, FALSE, 'follow-up-owner-user', 'follow-up-owner-note'
  );
  IF (SELECT availability FROM public.external_pursuits WHERE id = dossier) <> 'available'
    OR (SELECT shared_notes FROM public.external_pursuit_notes WHERE external_pursuit_id = dossier) <> 'Owner added context' THEN
    RAISE EXCEPTION 'w107_stale_concurrent_save_overwrote_field';
  END IF;
  owner_view := public.external_pursuit_for_actor(dossier, 'follow-up-owner-user');
  staff_view := public.external_pursuit_for_actor(dossier, 'follow-up-staff-user');
  SELECT item INTO owner_board FROM jsonb_array_elements(public.external_pursuit_board_for_actor('follow-up-owner-user')) item WHERE item->>'id' = dossier::TEXT;
  SELECT item INTO staff_board FROM jsonb_array_elements(public.external_pursuit_board_for_actor('follow-up-staff-user')) item WHERE item->>'id' = dossier::TEXT;
  IF owner_view::TEXT LIKE '%Staff-only%' OR owner_view ? 'audit'
    OR owner_view->'pursuit'->>'next_action' <> 'Request refreshed information'
    OR owner_view->'pursuit'->>'responsible_party' <> 'staff'
    OR owner_view->'pursuit'->>'external_url' <> 'https://example.test/dossier'
    OR owner_view->'pursuit'->>'target_company' <> 'Target company'
    OR owner_view->'pursuit'->>'source_channel' <> 'Introducer'
    OR owner_view->'pursuit'->>'revenue_meur' <> '12.5'
    OR owner_view->'pursuit'->>'ebitda_keur' <> '1.2'
    OR owner_view->'pursuit'->>'headcount' <> '34'
    OR staff_view->>'staff_internal_notes' <> 'Staff-only follow-up note' THEN
    RAISE EXCEPTION 'w107_projection_boundary_failed';
  END IF;
  IF owner_board IS NULL OR staff_board IS NULL
    OR owner_board ? 'staff_internal_notes'
    OR owner_board->>'next_action' <> 'Request refreshed information'
    OR owner_board->>'responsible_party' <> 'staff'
    OR owner_board->>'shared_notes' <> 'Owner added context'
    OR staff_board->>'staff_internal_notes' <> 'Staff-only follow-up note'
    OR owner_board->>'external_url' <> 'https://example.test/dossier'
    OR owner_board->>'target_company' <> 'Target company'
    OR owner_board->>'source_channel' <> 'Introducer' THEN
    RAISE EXCEPTION 'w107_board_projection_boundary_failed';
  END IF;
  BEGIN
    PERFORM public.update_external_pursuit_follow_up(dossier, 'Bad', TRUE, 'owner', TRUE, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, 'follow-up-other-user', 'other-owner-save');
    RAISE EXCEPTION 'w107_other_owner_write_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_external_pursuit_follow_up(dossier, 'Bad', TRUE, 'owner', TRUE, NULL, FALSE, NULL, FALSE, NULL, FALSE, 'Leak attempt', TRUE, 'follow-up-owner-user', 'owner-staff-note');
    RAISE EXCEPTION 'w107_owner_staff_note_write_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only staff may change internal notes.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_external_pursuit_follow_up(dossier, 'Missing owner', TRUE, NULL, TRUE, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, 'follow-up-staff-user', 'invalid-pair');
    RAISE EXCEPTION 'w107_unpaired_action_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'A next action requires one responsible party.' THEN RAISE; END IF;
  END;
  IF has_function_privilege('anon','public.update_external_pursuit_follow_up(uuid,text,boolean,text,boolean,text,boolean,date,boolean,text,boolean,text,boolean,text,text)','execute')
    OR has_function_privilege('authenticated','public.update_external_pursuit_follow_up(uuid,text,boolean,text,boolean,text,boolean,date,boolean,text,boolean,text,boolean,text,text)','execute')
    OR NOT has_function_privilege('service_role','public.update_external_pursuit_follow_up(uuid,text,boolean,text,boolean,text,boolean,date,boolean,text,boolean,text,boolean,text,text)','execute') THEN
    RAISE EXCEPTION 'w107_rpc_privilege_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.opportunities WHERE created_by IN ('follow-up-owner-user','follow-up-staff-user')
  ) THEN RAISE EXCEPTION 'w107_canonical_opportunity_changed'; END IF;
END $$;
ROLLBACK;
