\set ON_ERROR_STOP on
DO $$
DECLARE item record; allowed text[] := ARRAY['clipboard','pdr_feedback','pdr_goals','pdr_milestones','pdr_proposals','pdr_requests','pdr_work_cards'];
BEGIN
  FOR item IN SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') LOOP
    IF item.relname = ANY(allowed) THEN
      IF NOT has_table_privilege('anon',item.oid,'select') OR NOT has_table_privilege('authenticated',item.oid,'select') OR has_table_privilege('anon',item.oid,'insert,update,delete') OR has_table_privilege('authenticated',item.oid,'insert,update,delete') THEN RAISE EXCEPTION 'w147_public_read_exception_invalid:%',item.relname; END IF;
    ELSIF has_table_privilege('anon',item.oid,'select,insert,update,delete') OR has_table_privilege('authenticated',item.oid,'select,insert,update,delete') THEN RAISE EXCEPTION 'w147_browser_table_grant:%',item.relname;
    END IF;
    IF NOT has_table_privilege('service_role',item.oid,'select,insert,update,delete') THEN RAISE EXCEPTION 'w147_service_table_grant:%',item.relname; END IF;
  END LOOP;
  FOR item IN SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' LOOP
    IF has_sequence_privilege('anon',item.oid,'usage,select,update') OR has_sequence_privilege('authenticated',item.oid,'usage,select,update') OR NOT has_sequence_privilege('service_role',item.oid,'usage,select,update') THEN RAISE EXCEPTION 'w147_sequence_grant:%',item.relname; END IF;
  END LOOP;
  FOR item IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
    IF has_function_privilege('anon',item.oid,'execute') OR has_function_privilege('authenticated',item.oid,'execute') OR NOT has_function_privilege('service_role',item.oid,'execute') THEN RAISE EXCEPTION 'w147_function_grant:%',item.proname; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename <> ALL(allowed) AND roles && ARRAY['public'::name,'anon'::name,'authenticated'::name]) THEN RAISE EXCEPTION 'w147_browser_policy_remaining'; END IF;
END $$;
