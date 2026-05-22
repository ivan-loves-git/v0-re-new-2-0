-- Migration: Phase 8 opportunity field cleanup
-- Purpose: Add clean operational field names while keeping legacy columns as
-- temporary deploy-safe compatibility shims. A later cleanup can drop the old
-- columns after the new app version is live everywhere.

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS headcount_range TEXT;

UPDATE public.opportunities
SET headcount_range = headcount::TEXT
WHERE headcount_range IS NULL
  AND headcount IS NOT NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS repreneur_exposure opportunity_visibility;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'repreneur_visibility'
  ) THEN
    EXECUTE 'UPDATE public.opportunities
      SET repreneur_exposure = repreneur_visibility
      WHERE repreneur_exposure IS NULL';
  END IF;
END $$;

UPDATE public.opportunities
SET repreneur_exposure = 'anonymized'::opportunity_visibility
WHERE repreneur_exposure IS NULL;

ALTER TABLE public.opportunities
  ALTER COLUMN repreneur_exposure SET DEFAULT 'anonymized',
  ALTER COLUMN repreneur_exposure SET NOT NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS teaser_summary TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'anonymized_description'
  ) THEN
    EXECUTE 'UPDATE public.opportunities
      SET teaser_summary = anonymized_description
      WHERE teaser_summary IS NULL
        AND anonymized_description IS NOT NULL';
  END IF;
END $$;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'staff_notes'
  ) THEN
    EXECUTE 'UPDATE public.opportunities
      SET internal_notes = staff_notes
      WHERE internal_notes IS NULL
        AND staff_notes IS NOT NULL';
  END IF;
END $$;

ALTER TABLE public.ma_sources
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ma_sources'
      AND column_name = 'notes'
  ) THEN
    EXECUTE 'UPDATE public.ma_sources
      SET internal_notes = notes
      WHERE internal_notes IS NULL
        AND notes IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_repreneur_exposure
  ON public.opportunities(repreneur_exposure);

COMMENT ON COLUMN public.opportunities.repreneur_exposure IS
  'Canonical Phase 8 field controlling whether the opportunity can be shown to repreneurs and at what disclosure level.';
COMMENT ON COLUMN public.opportunities.teaser_summary IS
  'Canonical Phase 8 entrepreneur-visible teaser summary derived from the M&A teaser/deal-flow Excel text. No info memo storage in Phase 8.';
COMMENT ON COLUMN public.opportunities.internal_notes IS
  'Canonical Phase 8 internal staff-only opportunity notes. Never included in repreneur-visible summaries.';
COMMENT ON COLUMN public.opportunities.headcount_range IS
  'Exact Effectif value from Bertrand Excel, including ranges such as 40-50.';
COMMENT ON COLUMN public.ma_sources.internal_notes IS
  'Canonical Phase 8 staff-only source context. Do not expose to repreneurs.';
