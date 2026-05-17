-- Migration: Opportunity match recommendations for Re-New V2
-- Purpose: Store structured platform and human recommendations between one
-- repreneur and one opportunity. Out of scope: automatic AI matching.

DO $$ BEGIN
  CREATE TYPE opportunity_match_recommendation AS ENUM (
    'not_evaluated',
    'strong_fit',
    'possible_fit',
    'weak_fit',
    'not_fit'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE opportunity_match_status AS ENUM (
    'draft',
    'shortlisted',
    'proposed',
    'interested',
    'declined',
    'active_pursuit',
    'dropped'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.opportunity_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  status opportunity_match_status NOT NULL DEFAULT 'draft',
  platform_recommendation opportunity_match_recommendation NOT NULL DEFAULT 'not_evaluated',
  platform_score INTEGER,
  platform_reasons TEXT[] NOT NULL DEFAULT '{}',
  human_recommendation opportunity_match_recommendation NOT NULL DEFAULT 'not_evaluated',
  human_notes TEXT,
  created_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (opportunity_id, repreneur_id),
  CHECK (platform_score IS NULL OR (platform_score >= 0 AND platform_score <= 100))
);

COMMENT ON TABLE public.opportunity_matches IS
  'Staff-visible matching records between repreneurs and opportunities. Stores platform recommendation plus optional human recommendation.';
COMMENT ON COLUMN public.opportunity_matches.platform_recommendation IS
  'Platform-side structured recommendation value. This is a stored value, not hidden AI inference.';
COMMENT ON COLUMN public.opportunity_matches.human_recommendation IS
  'Optional human override/recommendation value from Re-New staff.';
COMMENT ON COLUMN public.opportunity_matches.platform_reasons IS
  'Structured short reasons supporting the platform recommendation.';

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_opportunity_id
  ON public.opportunity_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_repreneur_id
  ON public.opportunity_matches(repreneur_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_status
  ON public.opportunity_matches(status);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_platform_recommendation
  ON public.opportunity_matches(platform_recommendation);

DROP TRIGGER IF EXISTS update_opportunity_matches_updated_at ON public.opportunity_matches;
CREATE TRIGGER update_opportunity_matches_updated_at
  BEFORE UPDATE ON public.opportunity_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.opportunity_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view opportunity matches" ON public.opportunity_matches;
CREATE POLICY "Authenticated users can view opportunity matches"
  ON public.opportunity_matches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert opportunity matches" ON public.opportunity_matches;
CREATE POLICY "Authenticated users can insert opportunity matches"
  ON public.opportunity_matches FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update opportunity matches" ON public.opportunity_matches;
CREATE POLICY "Authenticated users can update opportunity matches"
  ON public.opportunity_matches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete opportunity matches" ON public.opportunity_matches;
CREATE POLICY "Authenticated users can delete opportunity matches"
  ON public.opportunity_matches FOR DELETE
  TO authenticated
  USING (true);

GRANT USAGE ON TYPE public.opportunity_match_recommendation TO authenticated;
GRANT USAGE ON TYPE public.opportunity_match_status TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunity_matches TO authenticated;
