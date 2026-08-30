-- PDR screening is the sole WAVE AI workflow that uses low reasoning.
-- Preserve already-recorded v1 PDR runs, which accurately used max reasoning
-- before the scoped v2 runtime change. New PDR prompt versions must use low.

BEGIN;

ALTER TABLE public.ai_generation_runs
  DROP CONSTRAINT IF EXISTS ai_generation_runs_reasoning_effort_check;

ALTER TABLE public.ai_generation_runs
  ADD CONSTRAINT ai_generation_runs_reasoning_effort_check CHECK (
    (feature <> 'pdr_screening' AND reasoning_effort = 'max')
    OR (feature = 'pdr_screening' AND reasoning_effort = 'low')
    OR (feature = 'pdr_screening' AND prompt_version = 'pdr-screening-v1' AND reasoning_effort = 'max')
  );

COMMIT;
