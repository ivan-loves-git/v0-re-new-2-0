\set ON_ERROR_STOP on
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.opportunity_recommendation_cycles;
  IF v_count<>0 THEN RAISE EXCEPTION 'historical cycle backfill'; END IF;
  IF (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications)<>0 THEN
    RAISE EXCEPTION 'historical initial assignment replay';
  END IF;
END $$;

-- Both canonical W172 paths must produce exactly one prospective cycle. The
-- original W175 initial assignment still fires only on a Proposed INSERT.
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES('75000000-0000-4000-8000-000000000011','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000005','proposed','w175-staff');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES('75000000-0000-4000-8000-000000000012','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000006','draft','w175-staff');
UPDATE public.opportunity_matches SET status='proposed'
WHERE id='75000000-0000-4000-8000-000000000012';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles)<>2 THEN
    RAISE EXCEPTION 'canonical clock changes did not create one cycle each';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycle_deliveries)<>4 THEN
    RAISE EXCEPTION 'each cycle needs two independent delivery intents';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycle_deliveries WHERE status='suppressed')<>4 THEN
    RAISE EXCEPTION 'new disabled keys must suppress at source';
  END IF;
  IF (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications)<>1 THEN
    RAISE EXCEPTION 'original assignment notification changed';
  END IF;
END $$;
