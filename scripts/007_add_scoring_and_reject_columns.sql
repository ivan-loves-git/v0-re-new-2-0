-- Add scoring and rejection columns to repreneurs table
-- Supports the two-tier scoring system and action-driven status transitions
-- NOTE: lifecycle_status is an ENUM type, not TEXT with CHECK constraint

-- 1. Add 'rejected' to the lifecycle_status ENUM type
ALTER TYPE lifecycle_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Tier 1 Score: Automated score from form data
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier1_score INTEGER;

-- 3. Tier 2 Stars: Manual 1-5 star rating set after interview
-- Setting this automatically qualifies the repreneur
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier2_stars INTEGER;

-- Add check constraint for tier2_stars range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'tier2_stars_range'
  ) THEN
    ALTER TABLE public.repreneurs
    ADD CONSTRAINT tier2_stars_range
    CHECK (tier2_stars IS NULL OR (tier2_stars >= 1 AND tier2_stars <= 5));
  END IF;
END $$;

-- 4. Rejection tracking: timestamp when rejected
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 5. Previous status: stored when rejecting, for un-reject functionality
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS previous_status TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.tier1_score IS 'Automated score calculated from form data (Q1-Q18), based on Bertrand scoring model';
COMMENT ON COLUMN public.repreneurs.tier2_stars IS 'Manual 1-5 star rating set after interview. Setting this auto-qualifies the repreneur.';
COMMENT ON COLUMN public.repreneurs.rejected_at IS 'Timestamp when the repreneur was rejected. NULL if not rejected.';
COMMENT ON COLUMN public.repreneurs.previous_status IS 'Status before rejection, used to restore status when un-rejecting.';
