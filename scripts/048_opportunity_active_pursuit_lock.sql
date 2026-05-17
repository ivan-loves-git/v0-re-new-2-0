-- Migration: Active pursuit lock for opportunity matches
-- Purpose: Ensure staff can validate only one active repreneur pursuit per opportunity.

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_matches_one_active_pursuit
  ON public.opportunity_matches(opportunity_id)
  WHERE status = 'active_pursuit';

COMMENT ON INDEX public.idx_opportunity_matches_one_active_pursuit IS
  'Allows at most one active_pursuit match per opportunity. Dropped pursuits automatically release the lock.';
