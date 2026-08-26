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
END $$;

ROLLBACK;
