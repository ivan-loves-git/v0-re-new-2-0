-- Governance #68: v3 keeps the low-reasoning PDR workflow while recording
-- the exact bug-aware prompt/schema pair used by each future run. Historical
-- v1/v2 entries remain valid and immutable.
BEGIN;

ALTER TABLE public.ai_generation_runs
  DROP CONSTRAINT IF EXISTS ai_generation_runs_reasoning_effort_check;

ALTER TABLE public.ai_generation_runs
  ADD CONSTRAINT ai_generation_runs_reasoning_effort_check CHECK (
    (feature <> 'pdr_screening' AND reasoning_effort = 'max')
    OR (feature = 'pdr_screening' AND prompt_version = 'pdr-screening-v1' AND reasoning_effort = 'max')
    OR (feature = 'pdr_screening' AND prompt_version IN ('pdr-screening-v2', 'pdr-screening-v3') AND reasoning_effort = 'low')
  );

COMMIT;
