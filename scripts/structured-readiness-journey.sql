-- =============================================================================
-- STRUCTURED READINESS JOURNEY - Combined Migration
-- =============================================================================
-- This migration implements the three-tier assessment system:
-- - Tier 2: 6 competency dimensions with weighted scoring
-- - Tier 3: 10 readiness milestones
-- - Journey Stage: Auto-derived from milestone count
-- =============================================================================

-- =============================================================================
-- PART 1: TIER 2 COMPETENCY DIMENSIONS
-- Transforms single tier2_stars into 6-dimension competency profile
-- =============================================================================

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

-- =============================================================================
-- PART 2: TIER 3 READINESS MILESTONES
-- 10 milestone checkboxes for tracking acquisition readiness
-- =============================================================================

-- Add 10 milestone boolean columns (all manual, team-verified)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_investment_thesis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_target_profile BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_first_intermediary BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_starter_pack BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_ldc_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_financing_proof BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_advisory_team BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_search_plan BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_first_target BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_dd_checklist BOOLEAN DEFAULT FALSE;

-- Add milestone count for efficient queries
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier3_milestone_count INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.ms_investment_thesis IS 'Milestone 1: Investment thesis validated - sector, size, geography, deal criteria documented';
COMMENT ON COLUMN public.repreneurs.ms_target_profile IS 'Milestone 2: Target profile approved - Re-New reviewed acquisition criteria';
COMMENT ON COLUMN public.repreneurs.ms_first_intermediary IS 'Milestone 3: First intermediary intro - connected to deal source';
COMMENT ON COLUMN public.repreneurs.ms_starter_pack IS 'Milestone 4: Starter Pack completed - finished Re-New training';
COMMENT ON COLUMN public.repreneurs.ms_ldc_validated IS 'Milestone 5: LdC validated - Lettre de Cadrage reviewed by Re-New';
COMMENT ON COLUMN public.repreneurs.ms_financing_proof IS 'Milestone 6: Financing proof - bank letter or investor commitment';
COMMENT ON COLUMN public.repreneurs.ms_advisory_team IS 'Milestone 7: Advisory team engaged - lawyer, accountant, or M&A advisor';
COMMENT ON COLUMN public.repreneurs.ms_search_plan IS 'Milestone 8: Search plan approved - active plan with timeline';
COMMENT ON COLUMN public.repreneurs.ms_first_target IS 'Milestone 9: First target contact - engaged with potential acquisition';
COMMENT ON COLUMN public.repreneurs.ms_dd_checklist IS 'Milestone 10: DD checklist ready - due diligence preparation complete';
COMMENT ON COLUMN public.repreneurs.tier3_milestone_count IS 'Count of completed milestones (0-10)';

-- =============================================================================
-- PART 3: JOURNEY STAGE DERIVATION
-- Auto-derive journey_stage from milestone count (no manual override)
-- =============================================================================

-- Ensure persona column exists (needed for serial_acquirer stage)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS persona TEXT;

-- Create function for stage computation
CREATE OR REPLACE FUNCTION compute_journey_stage(
  milestone_count INTEGER,
  persona TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Serial Acquirer: All 10 milestones + serial acquirer persona
  IF milestone_count = 10 AND persona = 'serial_acquirer' THEN
    RETURN 'serial_acquirer';
  -- Ready: 7-9 milestones (or 10 without serial persona)
  ELSIF milestone_count >= 7 THEN
    RETURN 'ready';
  -- Learner: 3-6 milestones
  ELSIF milestone_count >= 3 THEN
    RETURN 'learner';
  -- Explorer: 0-2 milestones
  ELSE
    RETURN 'explorer';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-update journey_stage when milestones change
CREATE OR REPLACE FUNCTION update_journey_stage_trigger() RETURNS TRIGGER AS $$
BEGIN
  -- Count completed milestones
  NEW.tier3_milestone_count := (
    CASE WHEN NEW.ms_investment_thesis THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_target_profile THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_first_intermediary THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_starter_pack THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_ldc_validated THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_financing_proof THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_search_plan THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_first_target THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_dd_checklist THEN 1 ELSE 0 END
  );

  -- Derive journey stage from milestone count and persona
  NEW.journey_stage := compute_journey_stage(
    NEW.tier3_milestone_count,
    NEW.persona
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_update_journey_stage ON public.repreneurs;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trg_update_journey_stage
  BEFORE INSERT OR UPDATE ON public.repreneurs
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_stage_trigger();

-- Update all existing repreneurs to recalculate milestone count and journey stage
-- This will trigger the function for each row
UPDATE public.repreneurs
SET ms_investment_thesis = COALESCE(ms_investment_thesis, FALSE)
WHERE TRUE;

-- Add comment
COMMENT ON FUNCTION compute_journey_stage IS 'Derives journey stage from milestone count: 0-2=explorer, 3-6=learner, 7-9=ready, 10+serial=serial_acquirer';

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Tier 2 Dimensions (weighted averages):
--   - Leadership (1.0x)
--   - Financial Acumen (1.0x)
--   - Communication (0.8x)
--   - Clarity of Vision (1.2x)
--   - Coachability (0.8x)
--   - Commitment (1.2x)
--   Pass threshold: 4.0 overall
--
-- Tier 3 Milestones (10 total):
--   Stage 1 (Explorer -> Learner): 1-3
--   Stage 2 (Learner -> Ready): 4-7
--   Stage 3 (Ready -> Serial): 8-10
--
-- Journey Stage Derivation:
--   Explorer: 0-2 milestones
--   Learner: 3-6 milestones
--   Ready: 7-9 milestones
--   Serial Acquirer: 10 milestones + persona = 'serial_acquirer'
-- =============================================================================
