-- Migration 019: Add Tier 2 Competency Dimensions
-- Transforms single tier2_stars into 6-dimension competency profile

-- Add 6 competency dimension columns (each 1-5 stars)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier2_leadership INTEGER CHECK (tier2_leadership IS NULL OR (tier2_leadership >= 1 AND tier2_leadership <= 5)),
ADD COLUMN IF NOT EXISTS tier2_financial_acumen INTEGER CHECK (tier2_financial_acumen IS NULL OR (tier2_financial_acumen >= 1 AND tier2_financial_acumen <= 5)),
ADD COLUMN IF NOT EXISTS tier2_communication INTEGER CHECK (tier2_communication IS NULL OR (tier2_communication >= 1 AND tier2_communication <= 5)),
ADD COLUMN IF NOT EXISTS tier2_clarity_of_vision INTEGER CHECK (tier2_clarity_of_vision IS NULL OR (tier2_clarity_of_vision >= 1 AND tier2_clarity_of_vision <= 5)),
ADD COLUMN IF NOT EXISTS tier2_coachability INTEGER CHECK (tier2_coachability IS NULL OR (tier2_coachability >= 1 AND tier2_coachability <= 5)),
ADD COLUMN IF NOT EXISTS tier2_commitment INTEGER CHECK (tier2_commitment IS NULL OR (tier2_commitment >= 1 AND tier2_commitment <= 5));

-- Add computed overall score and audit fields
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier2_overall NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS tier2_rated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tier2_rated_by UUID REFERENCES auth.users(id);

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.tier2_leadership IS 'Tier 2: Can they run a company? Make hard decisions? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_financial_acumen IS 'Tier 2: Understand deal structures, valuation, DD? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_communication IS 'Tier 2: Negotiate with sellers? Present to banks? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_clarity_of_vision IS 'Tier 2: Know what they are looking for? Clear target? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_coachability IS 'Tier 2: Open to guidance? Follow advice? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_commitment IS 'Tier 2: Full-time pursuit? Family support? (1-5 stars)';
COMMENT ON COLUMN public.repreneurs.tier2_overall IS 'Weighted average of all 6 Tier 2 dimensions';
COMMENT ON COLUMN public.repreneurs.tier2_rated_at IS 'When Tier 2 dimensions were last rated';
COMMENT ON COLUMN public.repreneurs.tier2_rated_by IS 'Who rated the Tier 2 dimensions';

-- Migrate existing tier2_stars to tier2_leadership as starting point
-- This preserves existing ratings while we transition to 6-dimension system
UPDATE public.repreneurs SET
  tier2_leadership = tier2_stars,
  tier2_overall = tier2_stars::NUMERIC
WHERE tier2_stars IS NOT NULL;
