\set ON_ERROR_STOP on

-- W173 disposable-local rehearsal. Every synthetic fixture is rolled back.
BEGIN;
SET session_replication_role = replica;
DELETE FROM public.repreneur_booking_request_events
 WHERE repreneur_id::text LIKE '73000000-0000-4000-8000-%';
DELETE FROM public.app_user_roles WHERE user_id LIKE 'w173-%';
DELETE FROM public.repreneurs WHERE id::text LIKE '73000000-0000-4000-8000-%';
RESET session_replication_role;

-- A fresh lead with no pre-existing links establishes both the ordinary path
-- and the cascade boundary.
SET session_replication_role = replica;
INSERT INTO public.repreneurs(id, email, first_name, last_name, created_by, is_demo)
VALUES ('73000000-0000-4000-8000-000000000001', 'w173-lead@example.test', 'W173', 'Lead', 'fixture', false),
       ('73000000-0000-4000-8000-000000000002', 'w173-cascade@example.test', 'W173', 'Cascade', 'fixture', false);
INSERT INTO public.app_user_roles(user_id, email, role)
VALUES ('w173-staff', 'w173-staff@example.test', 'staff'),
       ('w173-nonstaff', 'w173-nonstaff@example.test', 'repreneur');
RESET session_replication_role;

DO $$
DECLARE
  v_one public.repreneur_booking_request_events%ROWTYPE;
  v_two public.repreneur_booking_request_events%ROWTYPE;
  v_latest UUID;
BEGIN
  -- Exercise the real application execution role, not the database owner.
  SET LOCAL ROLE service_role;
  -- The migration itself must not manufacture history.
  IF EXISTS (SELECT 1 FROM public.repreneur_booking_request_events
             WHERE repreneur_id IN ('73000000-0000-4000-8000-000000000001',
                                    '73000000-0000-4000-8000-000000000002')) THEN
    RAISE EXCEPTION 'w173_migration_created_historical_event';
  END IF;

  SELECT * INTO v_one FROM public.record_repreneur_booking_request_sent(
    '73000000-0000-4000-8000-000000000001',
    clock_timestamp() - interval '30 minutes', 'w173-staff', 'w173-replay-key-1');
  IF v_one.id IS NULL OR v_one.recorded_by <> 'w173-staff' THEN
    RAISE EXCEPTION 'w173_valid_staff_record_failed';
  END IF;
  SELECT * INTO v_two FROM public.record_repreneur_booking_request_sent(
    '73000000-0000-4000-8000-000000000001',
    v_one.sent_at, 'w173-staff', 'w173-replay-key-1');
  IF v_two.id <> v_one.id OR (SELECT count(*) FROM public.repreneur_booking_request_events
                               WHERE recorded_by='w173-staff' AND idempotency_key='w173-replay-key-1') <> 1 THEN
    RAISE EXCEPTION 'w173_identical_replay_not_single_event';
  END IF;
  BEGIN
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000002', v_one.sent_at, 'w173-staff', 'w173-replay-key-1');
    RAISE EXCEPTION 'w173_changed_payload_same_key_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%booking_request_event_idempotency_payload_conflict%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000001', NULL, 'w173-staff', 'w173-missing-input');
    RAISE EXCEPTION 'w173_missing_input_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%booking_request_event_required_values_missing%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000001', clock_timestamp() + interval '1 minute', 'w173-staff', 'w173-future-input');
    RAISE EXCEPTION 'w173_future_input_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%booking_request_event_sent_at_must_not_be_future%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000001', clock_timestamp() - interval '3 hours', 'w173-nonstaff', 'w173-nonstaff-key');
    RAISE EXCEPTION 'w173_nonstaff_record_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%booking_request_event_staff_required%' THEN RAISE; END IF;
  END;

  -- Latest means sent_at order, not recording/insertion order.
  INSERT INTO public.repreneur_booking_request_events(repreneur_id, sent_at, recorded_by, idempotency_key)
  VALUES ('73000000-0000-4000-8000-000000000001', clock_timestamp() - interval '2 hours', 'w173-staff', 'w173-late-old-key');
  SELECT id INTO v_latest FROM public.repreneur_booking_request_events
   WHERE repreneur_id='73000000-0000-4000-8000-000000000001'
   ORDER BY sent_at DESC, id DESC LIMIT 1;
  IF v_latest <> v_one.id THEN
    RAISE EXCEPTION 'w173_latest_sent_at_not_selected';
  END IF;
END $$;

RESET ROLE;

-- UUID coercion is performed by PostgreSQL before the function body.
DO $$
BEGIN
  BEGIN
    EXECUTE $sql$SELECT * FROM public.record_repreneur_booking_request_sent('not-a-uuid', now(), 'w173-staff', 'w173-invalid-uuid')$sql$;
    RAISE EXCEPTION 'w173_invalid_uuid_allowed';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000001', clock_timestamp() - interval '1 minute', 'w173-staff', 'w173-anon');
    RAISE EXCEPTION 'w173_anon_execute_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM * FROM public.record_repreneur_booking_request_sent(
      '73000000-0000-4000-8000-000000000001', clock_timestamp() - interval '1 minute', 'w173-staff', 'w173-auth');
    RAISE EXCEPTION 'w173_authenticated_execute_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

DO $$
BEGIN
  SET LOCAL ROLE service_role;
  BEGIN
    UPDATE public.repreneur_booking_request_events SET sent_at=clock_timestamp()
    WHERE idempotency_key='w173-replay-key-1';
    RAISE EXCEPTION 'w173_service_update_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.repreneur_booking_request_events WHERE idempotency_key='w173-replay-key-1';
    RAISE EXCEPTION 'w173_service_delete_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.record_repreneur_booking_request_sent(uuid,timestamptz,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_repreneur_booking_request_sent(uuid,timestamptz,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.record_repreneur_booking_request_sent(uuid,timestamptz,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w173_function_privilege_boundary_failed';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.repreneur_booking_request_events', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.repreneur_booking_request_events', 'INSERT')
     OR has_table_privilege('service_role', 'public.repreneur_booking_request_events', 'UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN') THEN
    RAISE EXCEPTION 'w173_table_privilege_boundary_failed';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.record_repreneur_booking_request_sent(uuid,timestamptz,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'w173_function_is_security_definer';
  END IF;
  IF NOT (SELECT relforcerowsecurity FROM pg_class WHERE oid='public.repreneur_booking_request_events'::regclass) THEN
    RAISE EXCEPTION 'w173_force_rls_missing';
  END IF;
END $$;

-- Authorized owner-side profile deletion must cascade the W173 audit record.
INSERT INTO public.repreneur_booking_request_events(repreneur_id, sent_at, recorded_by, idempotency_key)
VALUES ('73000000-0000-4000-8000-000000000002', clock_timestamp() - interval '10 minutes', 'w173-staff', 'w173-cascade-key');
DELETE FROM public.repreneurs WHERE id='73000000-0000-4000-8000-000000000002';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.repreneur_booking_request_events
             WHERE idempotency_key='w173-cascade-key') THEN
    RAISE EXCEPTION 'w173_profile_delete_did_not_cascade';
  END IF;
END $$;

SELECT 'w173 behavioral and privilege rehearsal passed' AS result;
ROLLBACK;
