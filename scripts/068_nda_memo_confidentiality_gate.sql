-- Migration: Explicit NDA and memo confidentiality evidence
-- Purpose: Keep NDA receipt and completed signature as separate staff-verified
-- events for each active pursuit. Memo availability continues to come from a
-- real approved deal-book document with a file or external URL.
--
-- This migration is additive and deliberately does not backfill evidence from
-- the legacy nda_status value. Existing records retain their current status;
-- staff can record the distinct evidence timestamps going forward.

ALTER TABLE public.opportunity_matches
  ADD COLUMN IF NOT EXISTS nda_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunity_matches.nda_received_at IS
  'When the boutique NDA was received. Receipt alone never permits source or memo disclosure.';
COMMENT ON COLUMN public.opportunity_matches.nda_signed_at IS
  'When staff recorded the repreneur completed the boutique NDA. The signed or waived NDA status remains the access gate.';

CREATE INDEX IF NOT EXISTS idx_opportunity_matches_nda_signed_at
  ON public.opportunity_matches(nda_signed_at)
  WHERE nda_signed_at IS NOT NULL;

-- Rollback after the application code is disabled:
-- DROP INDEX IF EXISTS public.idx_opportunity_matches_nda_signed_at;
-- ALTER TABLE public.opportunity_matches
--   DROP COLUMN IF EXISTS nda_signed_at,
--   DROP COLUMN IF EXISTS nda_received_at;
