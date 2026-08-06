-- W-077: metadata-only WAVE AI generation ledger.
-- Additive. Apply before enabling the WAVE AI runtime in production.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_generation_runs (
  generation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  initiated_by_user_id TEXT NOT NULL CHECK (char_length(initiated_by_user_id) BETWEEN 1 AND 160),
  app_role TEXT NOT NULL CHECK (app_role = 'staff'),
  feature TEXT NOT NULL CHECK (feature IN ('email_draft', 'next_action', 'match_review')),
  workflow TEXT NOT NULL CHECK (char_length(workflow) BETWEEN 1 AND 80),
  surface TEXT NOT NULL CHECK (char_length(surface) BETWEEN 1 AND 120),
  prompt_version TEXT NOT NULL CHECK (char_length(prompt_version) BETWEEN 1 AND 80),
  output_schema_version TEXT NOT NULL CHECK (char_length(output_schema_version) BETWEEN 1 AND 80),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider = 'openai'),
  model TEXT NOT NULL DEFAULT 'gpt-5.6-luna' CHECK (model = 'gpt-5.6-luna'),
  reasoning_effort TEXT NOT NULL DEFAULT 'max' CHECK (reasoning_effort = 'max'),
  pricing_version TEXT NOT NULL CHECK (char_length(pricing_version) BETWEEN 1 AND 40),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'succeeded', 'failed')),
  error_code TEXT NOT NULL DEFAULT '' CHECK (char_length(error_code) <= 80),
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  cached_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  cache_write_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'preview', 'production', 'test')),
  release TEXT NOT NULL DEFAULT '' CHECK (char_length(release) <= 80),
  is_test BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'requested' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.ai_generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES public.ai_generation_runs(generation_id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL CHECK (char_length(actor_user_id) BETWEEN 1 AND 160),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'rendered',
    'edit_started',
    'copied',
    'send_review_opened',
    'send_succeeded',
    'send_failed',
    'workflow_action_confirmed',
    'feedback_helpful',
    'feedback_not_helpful',
    'discarded'
  )),
  reason_code TEXT NOT NULL DEFAULT '' CHECK (
    reason_code IN ('', 'wrong_fact', 'not_relevant', 'poor_wording', 'missing_context', 'other_without_text')
  ),
  action_key TEXT NOT NULL DEFAULT '' CHECK (char_length(action_key) <= 80),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (generation_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_started_at
  ON public.ai_generation_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_feature_status
  ON public.ai_generation_runs(feature, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_runs_actor_rate_limit
  ON public.ai_generation_runs(initiated_by_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_events_generation
  ON public.ai_generation_events(generation_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_events_type_time
  ON public.ai_generation_events(event_type, occurred_at DESC);

ALTER TABLE public.ai_generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_events FORCE ROW LEVEL SECURITY;

-- Better Auth, not Supabase Auth, owns application authorization. These tables
-- are therefore server-only: no browser role receives Data API privileges and
-- no permissive RLS policy is created.
REVOKE ALL ON TABLE public.ai_generation_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.ai_generation_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_generation_runs TO service_role;
GRANT SELECT, INSERT ON TABLE public.ai_generation_events TO service_role;

COMMENT ON TABLE public.ai_generation_runs IS
  'Metadata-only WAVE AI run ledger. Prompts, generated content, names, emails, notes and CRM entity IDs are forbidden.';
COMMENT ON TABLE public.ai_generation_events IS
  'Metadata-only human-review lifecycle events for WAVE AI generations. No free-text content.';
COMMENT ON COLUMN public.ai_generation_runs.initiated_by_user_id IS
  'Opaque Better Auth user ID. Never an email address or CRM identifier.';
COMMENT ON COLUMN public.ai_generation_events.reason_code IS
  'Allowlisted feedback reason. Free-text feedback is intentionally unsupported.';

COMMIT;
