\set ON_ERROR_STOP on

-- Disposable synthetic W172 rehearsal. Run only against the parent-created
-- local PostgreSQL cluster; it never contacts Supabase or sends email.
BEGIN;
SET session_replication_role = replica;
DELETE FROM public.opportunity_matches WHERE id::text LIKE '71000000-0000-4000-8000-%' OR id::text LIKE '72000000-0000-4000-8000-%';
DELETE FROM public.app_user_roles WHERE user_id LIKE 'w172-%';
DELETE FROM public.repreneurs WHERE id::text LIKE '71000000-0000-4000-8000-%' OR id::text LIKE '72000000-0000-4000-8000-%';
DELETE FROM public.opportunities WHERE id::text LIKE '71000000-0000-4000-8000-%' OR id::text LIKE '72000000-0000-4000-8000-%';
DELETE FROM public.ma_offices WHERE id = '71000000-0000-4000-8000-000000000002';
DELETE FROM public.ma_firms WHERE id = '71000000-0000-4000-8000-000000000001';
RESET session_replication_role;
SET session_replication_role = replica;
INSERT INTO public.ma_firms(id, name, status, created_by)
VALUES ('71000000-0000-4000-8000-000000000001', 'W172 fixture firm', 'active', 'fixture');
INSERT INTO public.ma_offices(id, firm_id, name, status, is_default, created_by)
VALUES ('71000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'W172 fixture office', 'active', true, 'fixture');
INSERT INTO public.opportunities(id, reference, status, source_office_id, created_by, is_demo)
VALUES ('71000000-0000-4000-8000-000000000003', 'W172-ACTIVE', 'active', '71000000-0000-4000-8000-000000000002', 'fixture', false);
INSERT INTO public.repreneurs(id, email, first_name, last_name, created_by, is_demo)
VALUES ('71000000-0000-4000-8000-000000000004', 'w172-repreneur@example.test', 'W172', 'Fixture', 'fixture', false);
INSERT INTO public.app_user_roles(user_id, email, role)
VALUES ('w172-staff', 'w172-staff@example.test', 'staff');
INSERT INTO public.app_user_roles(user_id, email, role, repreneur_id)
VALUES ('w172-portal', 'w172-repreneur@example.test', 'repreneur', '71000000-0000-4000-8000-000000000004');
RESET session_replication_role;

-- The writer must preserve the existing created_by audit convention because
-- opportunity_matches has no updated_by column.
INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
VALUES ('71000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000004', 'proposed', 'w172-staff');

-- This represents a row that existed before W172. Replica mode is used only
-- to establish synthetic history after bootstrap; it invokes no W172 trigger.
SET session_replication_role = replica;
INSERT INTO public.repreneurs(id, email, first_name, last_name, created_by, is_demo)
VALUES ('71000000-0000-4000-8000-000000000006', 'w172-historical@example.test', 'Historical', 'Fixture', 'fixture', false);
INSERT INTO public.app_user_roles(user_id, email, role, repreneur_id)
VALUES ('w172-historical-portal', 'w172-historical@example.test', 'repreneur', '71000000-0000-4000-8000-000000000006');
INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
VALUES ('71000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000006', 'proposed', 'legacy-import');
RESET session_replication_role;

SELECT 'w172 fixture seeded' AS result;

DO $$
DECLARE
  v_published timestamptz;
  v_expires timestamptz;
  v_first_expires timestamptz;
  v_renewed timestamptz;
BEGIN
  SELECT recommendation_published_at, recommendation_expires_at
  INTO v_published, v_expires
  FROM public.opportunity_matches
  WHERE id = '71000000-0000-4000-8000-000000000005';
  IF v_published IS NULL OR v_expires IS NULL
    OR v_expires < v_published + interval '72 hours' - interval '1 second'
    OR v_expires > v_published + interval '72 hours' + interval '1 second' THEN
    RAISE EXCEPTION 'w172_new_staff_proposed_window_invalid';
  END IF;

  UPDATE public.opportunity_matches
  SET human_notes = 'ordinary staff note'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  IF (SELECT recommendation_expires_at FROM public.opportunity_matches WHERE id = '71000000-0000-4000-8000-000000000005') <> v_expires THEN
    RAISE EXCEPTION 'w172_note_edit_reset_window';
  END IF;

  UPDATE public.opportunity_matches
  SET status = 'proposed'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  IF (SELECT recommendation_expires_at FROM public.opportunity_matches WHERE id = '71000000-0000-4000-8000-000000000005') <> v_expires THEN
    RAISE EXCEPTION 'w172_repropose_reset_open_window';
  END IF;

  UPDATE public.opportunity_matches
  SET recommendation_expires_at = clock_timestamp() - interval '1 microsecond'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  BEGIN
    PERFORM * FROM public.update_repreneur_opportunity_response(
      '71000000-0000-4000-8000-000000000005',
      '71000000-0000-4000-8000-000000000004',
      'interested', '{}', NULL
    );
    RAISE EXCEPTION 'w172_expired_proposed_interest_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_response_expired%' THEN RAISE; END IF;
  END;

  UPDATE public.opportunity_matches
  SET status = 'declined', recommendation_expires_at = clock_timestamp() - interval '1 microsecond'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  BEGIN
    PERFORM * FROM public.update_repreneur_opportunity_response(
      '71000000-0000-4000-8000-000000000005',
      '71000000-0000-4000-8000-000000000004',
      'interested', '{}', NULL
    );
    RAISE EXCEPTION 'w172_expired_declined_interest_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_response_expired%' THEN RAISE; END IF;
  END;

  UPDATE public.opportunity_matches
  SET status = 'proposed', recommendation_expires_at = clock_timestamp()
  WHERE id = '71000000-0000-4000-8000-000000000005';
  BEGIN
    PERFORM * FROM public.update_repreneur_opportunity_response(
      '71000000-0000-4000-8000-000000000005',
      '71000000-0000-4000-8000-000000000004',
      'interested', '{}', NULL
    );
    RAISE EXCEPTION 'w172_exact_deadline_interest_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_response_expired%' THEN RAISE; END IF;
  END;

  UPDATE public.opportunity_matches
  SET recommendation_expires_at = clock_timestamp() + interval '1 hour'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  UPDATE public.opportunity_matches
  SET status = 'interested'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  UPDATE public.opportunity_matches
  SET recommendation_expires_at = clock_timestamp() - interval '1 hour'
  WHERE id = '71000000-0000-4000-8000-000000000005';
  IF (SELECT status FROM public.opportunity_matches WHERE id = '71000000-0000-4000-8000-000000000005') <> 'interested' THEN
    RAISE EXCEPTION 'w172_existing_interested_changed';
  END IF;

  -- Existing rows have no inferred clock. Explicit staff renewal starts one.
  IF EXISTS (SELECT 1 FROM public.opportunity_matches WHERE id='71000000-0000-4000-8000-000000000007' AND recommendation_published_at IS NOT NULL) THEN
    RAISE EXCEPTION 'w172_historical_backfill_detected';
  END IF;
  SELECT publication_at, expires_at INTO v_published, v_expires
  FROM public.renew_opportunity_recommendation('71000000-0000-4000-8000-000000000007', 'w172-staff');
  IF v_published IS NULL OR v_expires IS NULL OR v_expires <= v_published THEN
    RAISE EXCEPTION 'w172_historical_renewal_failed';
  END IF;
  v_first_expires := v_expires;
  SELECT publication_at, expires_at INTO v_renewed, v_expires
  FROM public.renew_opportunity_recommendation('71000000-0000-4000-8000-000000000007', 'w172-staff');
  IF v_renewed <> v_published OR v_expires <> v_first_expires
    OR (SELECT recommendation_expires_at FROM public.opportunity_matches WHERE id='71000000-0000-4000-8000-000000000007') <> v_first_expires THEN
    RAISE EXCEPTION 'w172_open_renewal_moved_window';
  END IF;
END $$;

-- Seed isolated negative cases without their triggers; the tested insert below
-- runs with every W164/W172 guard enabled.
SET session_replication_role = replica;
INSERT INTO public.opportunities(id, reference, status, source_office_id, created_by, is_demo) VALUES
  ('72000000-0000-4000-8000-000000000001', 'W172-NONSTAFF', 'active', '71000000-0000-4000-8000-000000000002', 'fixture', false),
  ('72000000-0000-4000-8000-000000000002', 'W172-UNINVITED', 'active', '71000000-0000-4000-8000-000000000002', 'fixture', false),
  ('72000000-0000-4000-8000-000000000003', 'W172-INACTIVE', 'draft', NULL, 'fixture', false),
  ('72000000-0000-4000-8000-000000000004', 'W172-NAMESPACE', 'active', '71000000-0000-4000-8000-000000000002', 'fixture', true);
INSERT INTO public.repreneurs(id, email, first_name, last_name, created_by, is_demo) VALUES
  ('72000000-0000-4000-8000-000000000011', 'w172-nonstaff@example.test', 'Nonstaff', 'Fixture', 'fixture', false),
  ('72000000-0000-4000-8000-000000000012', 'w172-uninvited@example.test', 'Uninvited', 'Fixture', 'fixture', false),
  ('72000000-0000-4000-8000-000000000013', 'w172-inactive@example.test', 'Inactive', 'Fixture', 'fixture', false),
  ('72000000-0000-4000-8000-000000000014', 'w172-namespace@example.test', 'Namespace', 'Fixture', 'fixture', false);
INSERT INTO public.app_user_roles(user_id, email, role, repreneur_id) VALUES
  ('w172-nonstaff-portal', 'w172-nonstaff@example.test', 'repreneur', '72000000-0000-4000-8000-000000000011'),
  ('w172-inactive-portal', 'w172-inactive@example.test', 'repreneur', '72000000-0000-4000-8000-000000000013'),
  ('w172-namespace-portal', 'w172-namespace@example.test', 'repreneur', '72000000-0000-4000-8000-000000000014');
INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by) VALUES
  ('72000000-0000-4000-8000-000000000031', '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000011', 'proposed', 'legacy-import'),
  ('72000000-0000-4000-8000-000000000032', '72000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000012', 'proposed', 'legacy-import'),
  ('72000000-0000-4000-8000-000000000033', '72000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000013', 'proposed', 'legacy-import'),
  ('72000000-0000-4000-8000-000000000034', '72000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000014', 'proposed', 'legacy-import');
RESET session_replication_role;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
    VALUES ('72000000-0000-4000-8000-000000000021', '72000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000011', 'proposed', 'not-staff');
    RAISE EXCEPTION 'w172_nonstaff_publication_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_publication_staff_required%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
    VALUES ('72000000-0000-4000-8000-000000000022', '72000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000012', 'proposed', 'w172-staff');
    RAISE EXCEPTION 'w172_uninvited_publication_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_publication_portal_access_required%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
    VALUES ('72000000-0000-4000-8000-000000000023', '72000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000013', 'proposed', 'w172-staff');
    RAISE EXCEPTION 'w172_inactive_publication_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_publication_active_same_namespace_required%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.opportunity_matches(id, opportunity_id, repreneur_id, status, created_by)
    VALUES ('72000000-0000-4000-8000-000000000024', '72000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000014', 'proposed', 'w172-staff');
    RAISE EXCEPTION 'w172_cross_namespace_publication_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'w172_cross_namespace_publication_allowed' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%w164_cross_namespace_match_denied%' THEN RAISE; END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.renew_opportunity_recommendation('72000000-0000-4000-8000-000000000031', 'not-staff');
    RAISE EXCEPTION 'w172_invalid_staff_renewal_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_renewal_staff_required%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.renew_opportunity_recommendation('72000000-0000-4000-8000-000000000032', 'w172-staff');
    RAISE EXCEPTION 'w172_uninvited_renewal_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_renewal_visible_portal_required%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.renew_opportunity_recommendation('72000000-0000-4000-8000-000000000033', 'w172-staff');
    RAISE EXCEPTION 'w172_inactive_renewal_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_renewal_visible_portal_required%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.renew_opportunity_recommendation('72000000-0000-4000-8000-000000000034', 'w172-staff');
    RAISE EXCEPTION 'w172_cross_namespace_renewal_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_renewal_visible_portal_required%' THEN RAISE; END IF;
  END;
END $$;

-- The generic current RPC, not only the response-update RPC, must trip the
-- same trigger at the exact deadline.
DO $$
BEGIN
  UPDATE public.opportunity_matches
  SET status='proposed', recommendation_expires_at=clock_timestamp()
  WHERE id='71000000-0000-4000-8000-000000000007';
  BEGIN
    PERFORM * FROM public.express_opportunity_interest(
      '71000000-0000-4000-8000-000000000003',
      '71000000-0000-4000-8000-000000000006',
      'w172-historical-portal',
      clock_timestamp()
    );
    RAISE EXCEPTION 'w172_generic_exact_deadline_interest_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%recommendation_response_expired%' THEN RAISE; END IF;
  END;
END $$;

DO $$
DECLARE v_published timestamptz; v_expires timestamptz;
BEGIN
  UPDATE public.opportunity_matches
  SET recommendation_expires_at = clock_timestamp() - interval '1 microsecond'
  WHERE id='71000000-0000-4000-8000-000000000007';
  SET LOCAL ROLE service_role;
  SELECT publication_at, expires_at INTO v_published, v_expires
  FROM public.renew_opportunity_recommendation('71000000-0000-4000-8000-000000000007', 'w172-staff');
  IF v_published IS NULL OR v_expires <= v_published THEN
    RAISE EXCEPTION 'w172_service_renewal_failed';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM * FROM public.renew_opportunity_recommendation('71000000-0000-4000-8000-000000000007', 'w172-staff');
    RAISE EXCEPTION 'w172_anon_execute_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM * FROM public.renew_opportunity_recommendation('71000000-0000-4000-8000-000000000007', 'w172-staff');
    RAISE EXCEPTION 'w172_authenticated_execute_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.renew_opportunity_recommendation(uuid,text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.renew_opportunity_recommendation(uuid,text)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.renew_opportunity_recommendation(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w172_function_privilege_boundary_failed';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.renew_opportunity_recommendation(uuid,text)'::regprocedure) THEN
    RAISE EXCEPTION 'w172_renew_function_is_security_definer';
  END IF;
END $$;

SELECT 'w172 behavioral and privilege rehearsal passed' AS result;
ROLLBACK;
