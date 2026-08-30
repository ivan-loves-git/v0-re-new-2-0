-- One transaction per actor prevents concurrent requests escaping the AI cap.
CREATE OR REPLACE FUNCTION public.admit_wave_ai_run(payload jsonb, window_started_at timestamptz, request_limit integer)
RETURNS TABLE(generation_id uuid, trace_id uuid, started_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF request_limit < 1 OR payload->>'initiated_by_user_id' IS NULL THEN RAISE EXCEPTION 'invalid AI admission'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(payload->>'initiated_by_user_id', 0));
  IF (SELECT count(*) FROM public.ai_generation_runs WHERE initiated_by_user_id = payload->>'initiated_by_user_id' AND started_at >= window_started_at) >= request_limit THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'wave_ai_rate_limited';
  END IF;
  RETURN QUERY INSERT INTO public.ai_generation_runs (
    initiated_by_user_id, app_role, feature, workflow, surface, prompt_version, output_schema_version,
    provider, model, reasoning_effort, pricing_version, environment, release, is_test
  ) VALUES (
    payload->>'initiated_by_user_id', payload->>'app_role', payload->>'feature', payload->>'workflow', payload->>'surface', payload->>'prompt_version', payload->>'output_schema_version',
    payload->>'provider', payload->>'model', payload->>'reasoning_effort', payload->>'pricing_version', payload->>'environment', payload->>'release', COALESCE((payload->>'is_test')::boolean, false)
  ) RETURNING ai_generation_runs.generation_id, ai_generation_runs.trace_id, ai_generation_runs.started_at;
END $$;
REVOKE ALL ON FUNCTION public.admit_wave_ai_run(jsonb, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_wave_ai_run(jsonb, timestamptz, integer) TO service_role;
NOTIFY pgrst, 'reload schema';
