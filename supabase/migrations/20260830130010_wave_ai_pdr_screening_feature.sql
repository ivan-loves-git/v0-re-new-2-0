-- #40 keeps its ledger feature distinct without rewriting historical runs.
ALTER TABLE public.ai_generation_runs DROP CONSTRAINT IF EXISTS ai_generation_runs_feature_check;
ALTER TABLE public.ai_generation_runs ADD CONSTRAINT ai_generation_runs_feature_check
  CHECK (feature IN ('email_draft', 'next_action', 'match_review', 'pdr_screening'));
NOTIFY pgrst, 'reload schema';
