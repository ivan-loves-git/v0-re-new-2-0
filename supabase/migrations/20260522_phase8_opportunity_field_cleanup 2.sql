-- Migration: Phase 8 opportunity field cleanup
-- Purpose: Replace confusing opportunity/source field names with operational
-- names and preserve Bertrand Excel "Effectif" values without truncating ranges.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS headcount_range TEXT;

UPDATE public.opportunities
SET headcount_range = headcount::TEXT
WHERE headcount_range IS NULL
  AND headcount IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'repreneur_visibility'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'repreneur_exposure'
  ) THEN
    ALTER TABLE public.opportunities
      RENAME COLUMN repreneur_visibility TO repreneur_exposure;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'anonymized_description'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'teaser_summary'
  ) THEN
    ALTER TABLE public.opportunities
      RENAME COLUMN anonymized_description TO teaser_summary;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'staff_notes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE public.opportunities
      RENAME COLUMN staff_notes TO internal_notes;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ma_sources'
      AND column_name = 'notes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ma_sources'
      AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE public.ma_sources
      RENAME COLUMN notes TO internal_notes;
  END IF;
END $$;

ALTER TABLE public.opportunities
  DROP COLUMN IF EXISTS source_visibility;

DROP INDEX IF EXISTS idx_opportunities_repreneur_visibility;
CREATE INDEX IF NOT EXISTS idx_opportunities_repreneur_exposure
  ON public.opportunities(repreneur_exposure);

COMMENT ON COLUMN public.opportunities.repreneur_exposure IS
  'Controls whether the opportunity can be shown to repreneurs and at what disclosure level.';
COMMENT ON COLUMN public.opportunities.teaser_summary IS
  'Entrepreneur-visible teaser summary derived from the M&A teaser/deal-flow Excel text. No info memo storage in Phase 8.';
COMMENT ON COLUMN public.opportunities.internal_notes IS
  'Internal staff-only opportunity notes. Never included in repreneur-visible summaries.';
COMMENT ON COLUMN public.opportunities.headcount_range IS
  'Exact Effectif value from Bertrand Excel, including ranges such as 40-50.';
COMMENT ON COLUMN public.ma_sources.internal_notes IS
  'Staff-only source context. Do not expose to repreneurs.';
