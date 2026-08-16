-- Disposable W-110 database rehearsal. Apply migration 099 first, then run
-- this file against a temporary database with migrations 093, 094 and the
-- corrected 098. Every fixture is rolled back.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.repreneurs (id, first_name, last_name, email)
VALUES
  ('00000000-0000-4000-8000-000000011100', 'Capacity', 'Owner', 'capacity-owner@example.test'),
  ('00000000-0000-4000-8000-000000011102', 'Other', 'Owner', 'other-owner@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_user_roles (user_id, email, role, repreneur_id) VALUES
  ('w110-capacity-owner', 'capacity-owner@example.test', 'repreneur', '00000000-0000-4000-8000-000000011100'),
  ('w110-other-owner', 'other-owner@example.test', 'repreneur', '00000000-0000-4000-8000-000000011102'),
  ('w110-capacity-staff', 'capacity-staff@example.test', 'staff', NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  fresh_id UUID;
  stale_id UUID;
  unknown_id UUID;
  contact_id UUID;
  negotiation_id UUID;
  loi_id UUID;
  dd_id UUID;
  completed_id UUID;
  dropped_id UUID;
  pending_delete_id UUID;
  linked_id UUID;
  snapshot JSONB;
  original_confirmation TIMESTAMPTZ;
  standard_boundary_before JSONB;
  standard_boundary_after JSONB;
BEGIN
  fresh_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Fresh capacity dossier', 'meetings', 'available', '2026-05-01', NULL, NULL, 'w110-capacity-staff', 'w110-fresh');
  stale_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Stale capacity dossier', 'information', 'limited', '2026-04-30', NULL, NULL, 'w110-capacity-staff', 'w110-stale');
  unknown_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Unknown confirmation dossier', 'identified', 'unknown', '2026-05-02', NULL, NULL, 'w110-capacity-staff', 'w110-unknown');
  contact_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Contact qualification dossier', 'contact_qualification', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-contact');
  negotiation_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Negotiation dossier', 'negotiation', 'limited', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-negotiation');
  loi_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'LOI dossier', 'loi', 'unavailable', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-loi');
  dd_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'DD dossier', 'due_diligence_financing', 'unavailable', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-dd');
  completed_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Completed exclusion', 'completed', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-completed');
  dropped_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Dropped exclusion', 'dropped_archived', 'limited', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-dropped');
  pending_delete_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Deletion pending exclusion', 'meetings', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-delete-pending');
  linked_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Linked exclusion', 'meetings', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-linked');

  -- Synthetic boundary setup only. Application writes must use the explicit
  -- confirmation primitive tested below.
  UPDATE public.external_pursuits SET last_confirmed_at = '2026-04-01 12:00:00+00', last_confirmed_by = 'w110-capacity-staff' WHERE id = fresh_id;
  UPDATE public.external_pursuits SET last_confirmed_at = '2026-03-31 12:00:00+00', last_confirmed_by = 'w110-capacity-staff' WHERE id = stale_id;
  PERFORM public.request_external_pursuit_deletion(pending_delete_id, 'w110-capacity-owner', 'w110-request-delete');

  INSERT INTO public.opportunities (id, reference, status, repreneur_visibility, repreneur_exposure, created_by, updated_by)
  VALUES ('00000000-0000-4000-8000-000000011101', 'Re-New - FR - 110', 'draft', 'staff_only', 'staff_only', 'w110-capacity-staff', 'w110-capacity-staff')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.external_pursuit_opportunity_conversions (external_pursuit_id, opportunity_id, converted_by, idempotency_key)
  VALUES (linked_id, '00000000-0000-4000-8000-000000011101', 'w110-capacity-staff', 'w110-link')
  ON CONFLICT (external_pursuit_id) DO NOTHING;

  -- Freeze the standard Opportunity inventory, source, conversion-KPI and
  -- export-shaped rows before any W-110 read or confirmation action.
  SELECT jsonb_build_object(
    'inventory', (SELECT jsonb_object_agg(status, amount) FROM (SELECT status::TEXT, count(*) AS amount FROM public.opportunities GROUP BY status) rows),
    'source_firms', (SELECT count(*) FROM public.ma_firms),
    'source_offices', (SELECT count(*) FROM public.ma_offices),
    'source_links', (SELECT count(*) FROM public.opportunities WHERE source_id IS NOT NULL OR source_office_id IS NOT NULL),
    'conversion_kpi', (SELECT jsonb_object_agg(COALESCE(status::TEXT, 'null'), amount) FROM (SELECT status, count(*) AS amount FROM public.opportunity_matches GROUP BY status) rows),
    'export_rows', (SELECT md5(COALESCE(string_agg(to_jsonb(opportunity)::TEXT, '|' ORDER BY opportunity.id), '')) FROM public.opportunities opportunity)
  ) INTO standard_boundary_before;

  -- 2026-05-01 00:30 CEST is May 1 in Paris. Apr 1 is exactly 30 civil
  -- days before it; Mar 31 is 31 days. Due May 1 is today, not overdue.
  snapshot := public.external_pursuit_capacity_for_staff('w110-capacity-staff', '2026-04-30 22:30:00+00');
  IF snapshot->>'as_of_paris_date' <> '2026-05-01' THEN RAISE EXCEPTION 'w110_paris_date_failed'; END IF;
  IF snapshot->>'as_of_paris_timestamp' <> '2026-05-01T00:30:00+02:00' THEN RAISE EXCEPTION 'w110_paris_timestamp_failed'; END IF;
  IF (snapshot->'open_capacity'->>'total')::INT <> 7 THEN RAISE EXCEPTION 'w110_open_exclusions_failed'; END IF;
  IF snapshot->'open_capacity'->'stage' <> '{"identified":1,"contact_qualification":1,"information":1,"meetings":1,"negotiation":1,"loi":1,"due_diligence_financing":1,"completed":0,"dropped_archived":0}'::JSONB THEN RAISE EXCEPTION 'w110_full_stage_distribution_failed'; END IF;
  IF snapshot->'open_capacity'->'availability' <> '{"available":2,"limited":2,"unavailable":2,"unknown":1}'::JSONB THEN RAISE EXCEPTION 'w110_full_availability_distribution_failed'; END IF;
  IF snapshot->'open_capacity'->'freshness' <> '{"fresh":1,"stale":1,"unknown":5}'::JSONB THEN RAISE EXCEPTION 'w110_freshness_boundary_failed'; END IF;
  IF snapshot->'open_capacity'->'due' <> '{"overdue":1,"today":1,"upcoming":1,"none":4}'::JSONB THEN RAISE EXCEPTION 'w110_due_boundary_failed'; END IF;
  IF jsonb_array_length(snapshot->'open_dossiers') <> 7 THEN RAISE EXCEPTION 'w110_open_detail_reconciliation_failed'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(snapshot->'linked_dossiers') linked
    WHERE linked->>'opportunity_reference' = 'Re-New - FR - 110'
  ) THEN RAISE EXCEPTION 'w110_linked_bucket_failed'; END IF;
  IF COALESCE((
    SELECT dossier->>'is_open_capacity'
    FROM jsonb_array_elements(public.external_pursuit_board_for_actor('w110-capacity-owner')) dossier
    WHERE dossier->>'id' = linked_id::TEXT
  ), 'true') <> 'false' THEN RAISE EXCEPTION 'w110_linked_owner_confirmation_visible'; END IF;
  IF COALESCE((
    SELECT dossier->>'is_open_capacity'
    FROM jsonb_array_elements(public.external_pursuit_board_for_actor('w110-capacity-owner')) dossier
    WHERE dossier->>'id' = fresh_id::TEXT
  ), 'false') <> 'true' THEN RAISE EXCEPTION 'w110_open_owner_confirmation_hidden'; END IF;
  IF public.external_pursuit_capacity_for_staff('w110-capacity-staff', '2026-01-15 12:30:00+00')->>'as_of_paris_timestamp' <> '2026-01-15T13:30:00+01:00' THEN RAISE EXCEPTION 'w110_paris_winter_offset_failed'; END IF;

  -- A normal owner edit must not manufacture freshness evidence.
  PERFORM public.update_external_pursuit(unknown_id, 'Unknown confirmation dossier', NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, NULL, FALSE, 'w110-capacity-owner', 'w110-normal-edit');
  IF (SELECT last_confirmed_at FROM public.external_pursuits WHERE id = unknown_id) IS NOT NULL THEN RAISE EXCEPTION 'w110_normal_edit_confirmed_freshness'; END IF;

  -- The owner may explicitly confirm only their own dossier. The exact retry
  -- replays without changing the recorded actor/time.
  PERFORM public.confirm_external_pursuit_current(unknown_id, 'w110-capacity-owner', 'w110-confirm-owner');
  SELECT last_confirmed_at INTO original_confirmation FROM public.external_pursuits WHERE id = unknown_id;
  IF original_confirmation IS NULL
     OR (SELECT last_confirmed_by FROM public.external_pursuits WHERE id = unknown_id) <> 'w110-capacity-owner'
     OR NOT EXISTS (
       SELECT 1 FROM public.external_pursuit_audit_events event
       WHERE event.external_pursuit_id = unknown_id
         AND event.actor_user_id = 'w110-capacity-owner'
         AND event.idempotency_key = 'w110-confirm-owner'
         AND event.metadata = '{"confirmation":"current"}'::JSONB
         AND event.occurred_at >= original_confirmation
     ) THEN RAISE EXCEPTION 'w110_owner_explicit_confirmation_failed'; END IF;
  PERFORM public.confirm_external_pursuit_current(unknown_id, 'w110-capacity-owner', 'w110-confirm-owner');
  IF (SELECT last_confirmed_at FROM public.external_pursuits WHERE id = unknown_id) <> original_confirmation THEN RAISE EXCEPTION 'w110_confirmation_replay_failed'; END IF;

  -- Authorised staff may explicitly confirm any open dossier.
  PERFORM public.confirm_external_pursuit_current(stale_id, 'w110-capacity-staff', 'w110-confirm-staff');
  IF (SELECT last_confirmed_by FROM public.external_pursuits WHERE id = stale_id) <> 'w110-capacity-staff' THEN RAISE EXCEPTION 'w110_staff_confirmation_failed'; END IF;

  BEGIN
    PERFORM public.external_pursuit_capacity_for_staff('w110-capacity-owner', '2026-04-30 22:30:00+00');
    RAISE EXCEPTION 'w110_owner_capacity_read_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.external_pursuit_capacity_for_staff('missing-w110-user', '2026-04-30 22:30:00+00');
    RAISE EXCEPTION 'w110_unknown_capacity_actor_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.external_pursuit_capacity_for_staff(NULL, '2026-04-30 22:30:00+00');
    RAISE EXCEPTION 'w110_missing_capacity_actor_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.confirm_external_pursuit_current(fresh_id, 'w110-other-owner', 'w110-other-owner-confirm');
    RAISE EXCEPTION 'w110_other_owner_confirmation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.confirm_external_pursuit_current(linked_id, 'w110-capacity-owner', 'w110-linked-confirm');
    RAISE EXCEPTION 'w110_linked_confirmation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit is not open capacity.' THEN RAISE; END IF;
  END;

  -- Browser roles cannot bypass the server action; service_role owns the only
  -- direct execution grant for both primitives.
  IF has_function_privilege('anon', 'public.confirm_external_pursuit_current(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.confirm_external_pursuit_current(uuid,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.external_pursuit_capacity_for_staff(text,timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.external_pursuit_capacity_for_staff(text,timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.confirm_external_pursuit_current(uuid,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.external_pursuit_capacity_for_staff(text,timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w110_function_grants_failed';
  END IF;

  SELECT jsonb_build_object(
    'inventory', (SELECT jsonb_object_agg(status, amount) FROM (SELECT status::TEXT, count(*) AS amount FROM public.opportunities GROUP BY status) rows),
    'source_firms', (SELECT count(*) FROM public.ma_firms),
    'source_offices', (SELECT count(*) FROM public.ma_offices),
    'source_links', (SELECT count(*) FROM public.opportunities WHERE source_id IS NOT NULL OR source_office_id IS NOT NULL),
    'conversion_kpi', (SELECT jsonb_object_agg(COALESCE(status::TEXT, 'null'), amount) FROM (SELECT status, count(*) AS amount FROM public.opportunity_matches GROUP BY status) rows),
    'export_rows', (SELECT md5(COALESCE(string_agg(to_jsonb(opportunity)::TEXT, '|' ORDER BY opportunity.id), '')) FROM public.opportunities opportunity)
  ) INTO standard_boundary_after;
  IF standard_boundary_after IS DISTINCT FROM standard_boundary_before THEN RAISE EXCEPTION 'w110_standard_opportunity_boundary_changed'; END IF;
END $$;

ROLLBACK;
