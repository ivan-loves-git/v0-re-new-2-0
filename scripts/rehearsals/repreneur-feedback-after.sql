\set ON_ERROR_STOP on

DO $$
DECLARE v_rls boolean; v_force boolean;
BEGIN
  SELECT relrowsecurity, relforcerowsecurity INTO v_rls,v_force
    FROM pg_class WHERE oid='public.repreneur_feedback'::regclass;
  IF NOT v_rls OR NOT v_force THEN RAISE EXCEPTION 'Feedback RLS not enabled and forced'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='repreneur_feedback') THEN
    RAISE EXCEPTION 'Feedback has a browser policy';
  END IF;
  IF has_table_privilege('anon','public.repreneur_feedback','SELECT')
    OR has_table_privilege('anon','public.repreneur_feedback','INSERT')
    OR has_table_privilege('authenticated','public.repreneur_feedback','SELECT')
    OR has_table_privilege('authenticated','public.repreneur_feedback','INSERT')
    OR has_table_privilege('authenticated','public.repreneur_feedback','UPDATE')
    OR has_table_privilege('authenticated','public.repreneur_feedback','DELETE') THEN
    RAISE EXCEPTION 'Browser role received feedback table privileges';
  END IF;
  IF NOT has_table_privilege('service_role','public.repreneur_feedback','SELECT')
    OR NOT has_table_privilege('service_role','public.repreneur_feedback','INSERT')
    OR NOT has_function_privilege('service_role','public.staff_mutate_repreneur_feedback(uuid,bigint,text,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.staff_mutate_repreneur_feedback(uuid,bigint,text,text,text,text)','EXECUTE')
    OR has_function_privilege('anon','public.purge_expired_repreneur_feedback()','EXECUTE') THEN
    RAISE EXCEPTION 'Feedback service-only grants are incorrect';
  END IF;
END $$;

INSERT INTO public."user"(id,email) VALUES
  ('owner-fixture','owner@example.test'),
  ('staff-fixture','staff@example.test'),
  ('cascade-fixture','cascade@example.test');
INSERT INTO public.repreneurs(id,email,first_name,last_name) VALUES
  ('fa000000-0000-4000-8000-000000000001','owner@example.test','Synthetic','Owner'),
  ('fa000000-0000-4000-8000-000000000002','cascade@example.test','Synthetic','Cascade');
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id) VALUES
  ('owner-fixture','owner@example.test','repreneur','fa000000-0000-4000-8000-000000000001'),
  ('staff-fixture','staff@example.test','staff',NULL);

SET ROLE service_role;
INSERT INTO public.repreneur_feedback(id,sender_user_id,sender_repreneur_id,category,message,context_key)
VALUES
  ('fa000000-0000-4000-8000-000000000003','owner-fixture','fa000000-0000-4000-8000-000000000001','improvement','Synthetic message for staff triage.','portal_deals'),
  ('fa000000-0000-4000-8000-000000000004','owner-fixture','fa000000-0000-4000-8000-000000000001','difficulty','Synthetic concurrent feedback.','portal_profile'),
  ('fa000000-0000-4000-8000-000000000005','cascade-fixture','fa000000-0000-4000-8000-000000000002','other','Synthetic account-delete feedback.',NULL),
  ('fa000000-0000-4000-8000-000000000006','owner-fixture','fa000000-0000-4000-8000-000000000001','other','Synthetic old feedback record.',NULL);
RESET ROLE;

DO $$
DECLARE v_result jsonb; v_denied boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.repreneur_feedback WHERE status='new' AND version=1)<>4 THEN
    RAISE EXCEPTION 'New/version defaults missing';
  END IF;
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000003',1,'status','routed','staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'updated' OR (v_result->>'version')::bigint<>2 THEN
    RAISE EXCEPTION 'Staff status mutation failed';
  END IF;
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000003',1,'status','closed','staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'conflict' THEN RAISE EXCEPTION 'Stale staff edit did not fail'; END IF;
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000003',2,'redact',NULL,'staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'updated' OR EXISTS (
    SELECT 1 FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000003'
      AND (message IS NOT NULL OR redacted_at IS NULL OR version<>3)
  ) THEN RAISE EXCEPTION 'Staff redaction failed'; END IF;
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000003',3,'redact',NULL,'staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'already_redacted' THEN RAISE EXCEPTION 'Repeat redaction was not bounded'; END IF;
  BEGIN
    PERFORM public.staff_mutate_repreneur_feedback(
      'fa000000-0000-4000-8000-000000000003',3,'delete',NULL,'owner-fixture','owner@example.test');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Repreneur actor unexpectedly mutated staff queue'; END IF;
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000003',3,'delete',NULL,'staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'deleted' OR EXISTS (
    SELECT 1 FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000003'
  ) THEN RAISE EXCEPTION 'Staff deletion failed'; END IF;
END $$;

-- Fixture-only backdating proves the DB's own 90-day cutoff and the purge.
UPDATE public.repreneur_feedback SET created_at=clock_timestamp()-interval '91 days'
  WHERE id='fa000000-0000-4000-8000-000000000006';
DO $$ DECLARE v_result jsonb; BEGIN
  v_result:=public.staff_mutate_repreneur_feedback(
    'fa000000-0000-4000-8000-000000000006',1,'status','closed','staff-fixture','staff@example.test');
  IF v_result->>'outcome'<>'expired' THEN RAISE EXCEPTION 'Expired row accepted a triage mutation'; END IF;
  IF public.purge_expired_repreneur_feedback()<>1 THEN RAISE EXCEPTION 'Purge did not remove exactly one expired row'; END IF;
  IF EXISTS (SELECT 1 FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000006') THEN
    RAISE EXCEPTION 'Expired feedback survived purge';
  END IF;
END $$;

DELETE FROM public."user" WHERE id='cascade-fixture';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.repreneur_feedback WHERE id='fa000000-0000-4000-8000-000000000005') THEN
    RAISE EXCEPTION 'Actual auth-user deletion did not cascade feedback';
  END IF;
  IF (SELECT count(*) FROM public.repreneur_feedback)<>1 THEN
    RAISE EXCEPTION 'Unexpired unrelated feedback was lost';
  END IF;
END $$;
