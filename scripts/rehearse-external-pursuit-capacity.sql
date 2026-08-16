-- Disposable W-110 database rehearsal. Apply migration 099 first, then run
-- this file against a temporary database with migrations 093, 094 and 098.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.repreneurs (id, first_name, last_name, email)
VALUES ('00000000-0000-4000-8000-000000011100', 'Capacity', 'Owner', 'capacity-owner@example.test')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.app_user_roles (user_id, email, role, repreneur_id) VALUES
  ('w110-capacity-owner', 'capacity-owner@example.test', 'repreneur', '00000000-0000-4000-8000-000000011100'),
  ('w110-capacity-staff', 'capacity-staff@example.test', 'staff', NULL)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  fresh_id UUID;
  stale_id UUID;
  never_id UUID;
  completed_id UUID;
  pending_delete_id UUID;
  linked_id UUID;
  snapshot JSONB;
  original_confirmation TIMESTAMPTZ;
BEGIN
  fresh_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Fresh capacity dossier', 'meetings', 'available', '2026-05-01', NULL, NULL, 'w110-capacity-staff', 'w110-fresh');
  stale_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Stale capacity dossier', 'information', 'limited', '2026-04-30', NULL, NULL, 'w110-capacity-staff', 'w110-stale');
  never_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Never confirmed dossier', 'identified', 'unknown', '2026-05-02', NULL, NULL, 'w110-capacity-staff', 'w110-never');
  completed_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Completed exclusion', 'completed', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-completed');
  pending_delete_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Deletion pending exclusion', 'meetings', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-delete-pending');
  linked_id := public.create_external_pursuit('00000000-0000-4000-8000-000000011100', 'Linked exclusion', 'meetings', 'available', NULL, NULL, NULL, 'w110-capacity-staff', 'w110-linked');

  UPDATE public.external_pursuits SET last_confirmed_at = '2026-04-01 12:00:00+00', last_confirmed_by = 'w110-capacity-staff' WHERE id = fresh_id;
  UPDATE public.external_pursuits SET last_confirmed_at = '2026-03-31 12:00:00+00', last_confirmed_by = 'w110-capacity-staff' WHERE id = stale_id;
  PERFORM public.request_external_pursuit_deletion(pending_delete_id, 'w110-capacity-owner', 'w110-request-delete');

  INSERT INTO public.opportunities (id, reference, status, repreneur_visibility, repreneur_exposure, created_by, updated_by)
  VALUES ('00000000-0000-4000-8000-000000011101', 'Re-New - FR - 110', 'draft', 'staff_only', 'staff_only', 'w110-capacity-staff', 'w110-capacity-staff')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.external_pursuit_opportunity_conversions (external_pursuit_id, opportunity_id, converted_by, idempotency_key)
  VALUES (linked_id, '00000000-0000-4000-8000-000000011101', 'w110-capacity-staff', 'w110-link')
  ON CONFLICT (external_pursuit_id) DO NOTHING;

  -- 2026-05-01 00:30 CEST is May 1 in Paris. Apr 1 is exactly 30 civil
  -- days before it; Mar 31 is 31 days. Due May 1 is today, not overdue.
  snapshot := public.external_pursuit_capacity_for_staff('w110-capacity-staff', '2026-04-30 22:30:00+00');
  IF snapshot->>'as_of_paris_date' <> '2026-05-01' THEN RAISE EXCEPTION 'w110_paris_date_failed'; END IF;
  IF (snapshot->'open_capacity'->>'total')::INT <> 3 THEN RAISE EXCEPTION 'w110_open_exclusions_failed'; END IF;
  IF (snapshot->'open_capacity'->'freshness'->>'fresh')::INT <> 1
     OR (snapshot->'open_capacity'->'freshness'->>'stale')::INT <> 1
     OR (snapshot->'open_capacity'->'freshness'->>'never_confirmed')::INT <> 1 THEN RAISE EXCEPTION 'w110_freshness_boundary_failed'; END IF;
  IF (snapshot->'open_capacity'->'due'->>'today')::INT <> 1
     OR (snapshot->'open_capacity'->'due'->>'overdue')::INT <> 1
     OR (snapshot->'open_capacity'->'due'->>'upcoming')::INT <> 1 THEN RAISE EXCEPTION 'w110_due_boundary_failed'; END IF;
  IF jsonb_array_length(snapshot->'linked_dossiers') <> 1
     OR snapshot->'linked_dossiers'->0->>'opportunity_reference' <> 'Re-New - FR - 110' THEN RAISE EXCEPTION 'w110_linked_bucket_failed'; END IF;

  PERFORM public.confirm_external_pursuit_current(never_id, 'w110-capacity-staff', 'w110-confirm-never');
  SELECT last_confirmed_at INTO original_confirmation FROM public.external_pursuits WHERE id = never_id;
  IF original_confirmation IS NULL
     OR (SELECT last_confirmed_by FROM public.external_pursuits WHERE id = never_id) <> 'w110-capacity-staff' THEN RAISE EXCEPTION 'w110_explicit_confirmation_failed'; END IF;
  PERFORM public.confirm_external_pursuit_current(never_id, 'w110-capacity-staff', 'w110-confirm-never');
  IF (SELECT last_confirmed_at FROM public.external_pursuits WHERE id = never_id) <> original_confirmation THEN RAISE EXCEPTION 'w110_confirmation_replay_failed'; END IF;

  BEGIN
    PERFORM public.external_pursuit_capacity_for_staff('w110-capacity-owner', '2026-04-30 22:30:00+00');
    RAISE EXCEPTION 'w110_owner_capacity_read_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.confirm_external_pursuit_current(fresh_id, 'w110-capacity-owner', 'w110-owner-confirm');
    RAISE EXCEPTION 'w110_owner_confirmation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit access denied.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.confirm_external_pursuit_current(linked_id, 'w110-capacity-staff', 'w110-linked-confirm');
    RAISE EXCEPTION 'w110_linked_confirmation_was_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'External Pursuit is not open capacity.' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;
