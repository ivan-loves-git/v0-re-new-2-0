-- Disposable PostgreSQL 17 security contract, including actual role calls.
DO $$
DECLARE t TEXT; r TEXT; f REGPROCEDURE;
BEGIN
  IF current_database()<>'renew_w175_rehearsal'
    OR inet_server_addr()::TEXT<>'127.0.0.1/32' THEN
    RAISE EXCEPTION 'not disposable localhost';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'opportunity_recommendation_cycles',
    'opportunity_recommendation_cycle_deliveries'
  ] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class
      WHERE oid=('public.'||t)::REGCLASS AND relrowsecurity AND relforcerowsecurity) THEN
      RAISE EXCEPTION 'missing forced RLS';
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(r,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
        RAISE EXCEPTION 'browser table privilege';
      END IF;
    END LOOP;
    IF NOT has_table_privilege('service_role','public.'||t,'SELECT')
      OR has_table_privilege('service_role','public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') THEN
      RAISE EXCEPTION 'service privilege drift';
    END IF;
  END LOOP;
  FOR f IN SELECT oid::REGPROCEDURE FROM pg_proc
    WHERE pronamespace='public'::REGNAMESPACE
      AND (proname LIKE 'w175_%cycle%'
        OR proname IN ('w171_guard_recommendation_clock_source',
          'w175_guard_match_delete_during_delivery')) LOOP
    IF has_function_privilege('anon',f,'EXECUTE')
      OR has_function_privilege('authenticated',f,'EXECUTE') THEN
      RAISE EXCEPTION 'browser function privilege %',f;
    END IF;
  END LOOP;
END $$;

SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.opportunity_recommendation_cycles;
    RAISE EXCEPTION 'anon table read unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.w175_claim_cycle_delivery(
      '75000000-ffff-4000-8000-000000000001','client_reminder');
    RAISE EXCEPTION 'anon claim unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM 1 FROM public.opportunity_recommendation_cycle_deliveries;
    RAISE EXCEPTION 'authenticated table read unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.w175_cycle_delivery_payload(
      '75000000-ffff-4000-8000-000000000001','staff_expiry');
    RAISE EXCEPTION 'authenticated payload unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET ROLE service_role;
DO $$ BEGIN
  PERFORM 1 FROM public.opportunity_recommendation_cycles LIMIT 1;
  IF public.w175_claim_cycle_delivery(
      '75000000-ffff-4000-8000-000000000001','client_reminder'
    )->>'status'<>'missing' THEN
    RAISE EXCEPTION 'service bounded RPC unavailable';
  END IF;
  BEGIN
    DELETE FROM public.opportunity_recommendation_cycles WHERE false;
    RAISE EXCEPTION 'service raw delete unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
