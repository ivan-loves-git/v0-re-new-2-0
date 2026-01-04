-- Add scoring and rejection columns to repreneurs table
-- Supports the two-tier scoring system and action-driven status transitions

-- Tier 1 Score: Automated score from form data
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier1_score INTEGER;

-- Tier 2 Stars: Manual 1-5 star rating set after interview
-- Setting this automatically qualifies the repreneur
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier2_stars INTEGER
CHECK (tier2_stars IS NULL OR (tier2_stars >= 1 AND tier2_stars <= 5));

-- Rejection tracking: timestamp when rejected
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Previous status: stored when rejecting, for un-reject functionality
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS previous_status TEXT
CHECK (previous_status IS NULL OR previous_status IN ('lead', 'qualified', 'client'));

-- Update lifecycle_status constraint to include 'rejected'
-- First, drop the existing constraint if it exists
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%lifecycle_status%'
  ) THEN
    ALTER TABLE public.repreneurs DROP CONSTRAINT IF EXISTS repreneurs_lifecycle_status_check;
  END IF;
END $$;

-- Add the new constraint with 'rejected' included
ALTER TABLE public.repreneurs
DROP CONSTRAINT IF EXISTS repreneurs_lifecycle_status_check;

ALTER TABLE public.repreneurs
ADD CONSTRAINT repreneurs_lifecycle_status_check
CHECK (lifecycle_status IN ('lead', 'qualified', 'client', 'rejected'));

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.tier1_score IS 'Automated score calculated from form data (Q1-Q18), based on Bertrand scoring model';
COMMENT ON COLUMN public.repreneurs.tier2_stars IS 'Manual 1-5 star rating set after interview. Setting this auto-qualifies the repreneur.';
COMMENT ON COLUMN public.repreneurs.rejected_at IS 'Timestamp when the repreneur was rejected. NULL if not rejected.';
COMMENT ON COLUMN public.repreneurs.previous_status IS 'Status before rejection, used to restore status when un-rejecting.';
