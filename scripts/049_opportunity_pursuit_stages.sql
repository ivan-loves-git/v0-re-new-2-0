-- Migration: Opportunity pursuit stage tracking
-- Purpose: Track the current stage and lightweight history for a validated active pursuit.

DO $$ BEGIN
  CREATE TYPE opportunity_pursuit_stage AS ENUM (
    'interest',
    'info_memo_received',
    'intermediary_meeting',
    'seller_meeting',
    'loi',
    'closed',
    'dropped'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS pursuit_stage opportunity_pursuit_stage,
  ADD COLUMN IF NOT EXISTS pursuit_stage_notes TEXT,
  ADD COLUMN IF NOT EXISTS pursuit_stage_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS pursuit_stage_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunity_matches.pursuit_stage IS
  'Current staff-controlled stage for a validated pursuit. Null before active pursuit validation.';
COMMENT ON COLUMN public.opportunity_matches.pursuit_stage_notes IS
  'Internal staff note for the latest pursuit stage update; not exposed to repreneurs.';

CREATE TABLE IF NOT EXISTS public.opportunity_pursuit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  stage opportunity_pursuit_stage NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.opportunity_pursuit_events IS
  'Lightweight history of stage changes for one opportunity-repreneur pursuit.';
COMMENT ON COLUMN public.opportunity_pursuit_events.note IS
  'Internal staff note for this stage event; not exposed to repreneurs.';

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_pursuit_stage
  ON public.opportunity_matches(pursuit_stage);
CREATE INDEX IF NOT EXISTS idx_opportunity_pursuit_events_match_id
  ON public.opportunity_pursuit_events(match_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_pursuit_events_opportunity_id
  ON public.opportunity_pursuit_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_pursuit_events_repreneur_id
  ON public.opportunity_pursuit_events(repreneur_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_pursuit_events_created_at
  ON public.opportunity_pursuit_events(created_at DESC);

ALTER TABLE public.opportunity_pursuit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view opportunity pursuit events" ON public.opportunity_pursuit_events;
CREATE POLICY "Authenticated users can view opportunity pursuit events"
  ON public.opportunity_pursuit_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert opportunity pursuit events" ON public.opportunity_pursuit_events;
CREATE POLICY "Authenticated users can insert opportunity pursuit events"
  ON public.opportunity_pursuit_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT USAGE ON TYPE public.opportunity_pursuit_stage TO authenticated, service_role;
GRANT SELECT, INSERT ON public.opportunity_pursuit_events TO authenticated, service_role;

UPDATE public.opportunity_matches
SET
  pursuit_stage = COALESCE(pursuit_stage, 'interest'::opportunity_pursuit_stage),
  pursuit_stage_updated_at = COALESCE(pursuit_stage_updated_at, reviewed_at, updated_at, NOW())
WHERE status = 'active_pursuit';
