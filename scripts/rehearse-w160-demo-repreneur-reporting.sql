-- Disposable W-160 rehearsal. Apply the migration first, then run this in a
-- temporary Supabase-compatible database. Everything is rolled back.
\set ON_ERROR_STOP on

BEGIN;

-- The production manifest is intentionally not replayed here. The release
-- preflight supplies and locks its reviewed IDs/timestamps/fingerprints. This
-- rehearsal proves the invariant shape: a DEMO repreneur and its DEMO
-- opportunity-side activity do not enter production reads, while a real row
-- remains eligible.
DO $$
DECLARE
  capacity_def TEXT;
BEGIN
  SELECT pg_get_functiondef('public.external_pursuit_capacity_for_staff(text,timestamptz)'::regprocedure) INTO capacity_def;
  IF capacity_def NOT LIKE '%owner.is_demo = FALSE%' THEN
    RAISE EXCEPTION 'w160_external_pursuit_demo_owner_filter_missing';
  END IF;
  IF capacity_def NOT LIKE '%opportunity.is_demo = FALSE%' THEN
    RAISE EXCEPTION 'w160_external_pursuit_demo_opportunity_filter_missing';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.apply_w160_demo_repreneur_classification(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.apply_w160_demo_repreneur_classification(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.apply_w160_demo_repreneur_classification(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'w160_manifest_function_grants_failed';
  END IF;
  IF pg_get_functiondef('public.express_opportunity_interest(uuid,uuid,text,timestamptz)'::regprocedure) NOT LIKE '%w160_require_non_demo_repreneur%'
     OR pg_get_functiondef('public.express_opportunity_interest(uuid,uuid,text,timestamptz)'::regprocedure) NOT LIKE '%''dropped''%'
     OR pg_get_functiondef('public.update_repreneur_opportunity_response(uuid,uuid,text,text[],text)'::regprocedure) NOT LIKE '%w160_require_non_demo_repreneur%'
     OR pg_get_functiondef('public.journey_submit_repreneur_signed_copy(uuid,uuid,text,text,text,text,bigint,text)'::regprocedure) NOT LIKE '%w160_require_non_demo_repreneur%'
     OR pg_get_functiondef('public.journey_repreneur_can_access_confidential(uuid,uuid,uuid)'::regprocedure) NOT LIKE '%r.is_demo=false%'
     OR pg_get_functiondef('public.journey_repreneur_authorized_template(uuid,uuid)'::regprocedure) NOT LIKE '%r.is_demo=false%'
     OR pg_get_functiondef('public.claim_opportunity_memo_notification(uuid,uuid,timestamptz)'::regprocedure) NOT LIKE '%r.is_demo=false%'
  THEN
    RAISE EXCEPTION 'w160_demo_repreneur_rpc_veto_missing';
  END IF;
END $$;

-- Exercise the database veto itself. The surrounding transaction is rolled
-- back, so this fixture never becomes persistent rehearsal data.
INSERT INTO public.repreneurs (id, email, first_name, last_name, is_demo)
VALUES (
  '00000000-0000-4000-8000-000000001160'::UUID,
  'w160-demo-rehearsal@invalid.example',
  'W160',
  'Demo rehearsal',
  TRUE
);

DO $$
BEGIN
  PERFORM public.w160_require_non_demo_repreneur('00000000-0000-4000-8000-000000001160'::UUID);
  RAISE EXCEPTION 'w160_demo_repreneur_veto_failed';
EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'demo_repreneur_not_available' THEN
      RAISE;
    END IF;
END $$;

ROLLBACK;
