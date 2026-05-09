-- =============================================================================
-- MIGRATION 033: Milestones V2 — 18 milestones, 5 journey stages
-- =============================================================================
-- Redesign: 11 flat milestones → 18 milestones in 4 transition groups
-- Journey stages: Explorer → Learner → Ready → Execution → Post-acquisition
-- Old columns kept for safety, new columns added alongside
-- =============================================================================

-- =====================
-- 1. ADD NEW MILESTONE COLUMNS
-- =====================

-- Group 1: Explorer → Learner (2 milestones)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_decision_to_pursue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_availability_confirmed BOOLEAN DEFAULT FALSE;

-- Group 2: Learner → Ready (7 milestones)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_target_profile_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_pitch_plan BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_equity_range BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_deal_breakers BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_advisory_team_structured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_leadership_assessment_passed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_advisory_team_identified BOOLEAN DEFAULT FALSE;

-- Group 3: Ready → Execution (7 milestones)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_intermediary_meeting BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_seller_meeting BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_loi_issued BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_due_diligence BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_negotiation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_financing_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_closing BOOLEAN DEFAULT FALSE;

-- Group 4: Execution → Post-acquisition (2 milestones)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_plan_100_days BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ms_plan_3_years BOOLEAN DEFAULT FALSE;

-- =====================
-- 2. MIGRATE EXISTING DATA (old → new where semantic match exists)
-- =====================

UPDATE public.repreneurs SET
  ms_target_profile_sheet = COALESCE(ms_investment_thesis, FALSE),
  ms_intermediary_meeting = COALESCE(ms_first_intermediary, FALSE),
  ms_financing_validated = COALESCE(ms_financing_proof, FALSE),
  ms_advisory_team_identified = COALESCE(ms_advisory_team, FALSE),
  ms_due_diligence = COALESCE(ms_dd_checklist, FALSE),
  ms_closing = COALESCE(ms_first_acquisition, FALSE)
WHERE TRUE;

-- Note: ms_target_profile, ms_starter_pack, ms_ldc_validated, ms_search_plan, ms_first_target
-- have no direct new equivalent. Old columns remain for reference.

-- =====================
-- 3. ADD COLUMN COMMENTS
-- =====================

COMMENT ON COLUMN public.repreneurs.ms_decision_to_pursue IS 'G1: Repreneurship is primary professional project';
COMMENT ON COLUMN public.repreneurs.ms_availability_confirmed IS 'G1: Can dedicate necessary time to the project';
COMMENT ON COLUMN public.repreneurs.ms_target_profile_sheet IS 'G2: Target profile defined (geo, sectors, metrics, model)';
COMMENT ON COLUMN public.repreneurs.ms_pitch_plan IS 'G2: Pitch ready (why me + value creation plan)';
COMMENT ON COLUMN public.repreneurs.ms_equity_range IS 'G2: Equity range and source confirmed';
COMMENT ON COLUMN public.repreneurs.ms_deal_breakers IS 'G2: Deal breakers identified (client dependency, margins, litigation, working capital)';
COMMENT ON COLUMN public.repreneurs.ms_advisory_team_structured IS 'G2: Advisory team structured (accountant, lawyer)';
COMMENT ON COLUMN public.repreneurs.ms_leadership_assessment_passed IS 'G2: Leadership assessment completed with positive result';
COMMENT ON COLUMN public.repreneurs.ms_advisory_team_identified IS 'G2: Advisory team identified (lawyers, accountants)';
COMMENT ON COLUMN public.repreneurs.ms_intermediary_meeting IS 'G3: First intermediary meeting held';
COMMENT ON COLUMN public.repreneurs.ms_seller_meeting IS 'G3: First seller meeting held';
COMMENT ON COLUMN public.repreneurs.ms_loi_issued IS 'G3: Letter of Intent issued';
COMMENT ON COLUMN public.repreneurs.ms_due_diligence IS 'G3: Due diligence initiated';
COMMENT ON COLUMN public.repreneurs.ms_negotiation IS 'G3: Negotiation in progress';
COMMENT ON COLUMN public.repreneurs.ms_financing_validated IS 'G3: Financing validated (bank contacts and/or first validation)';
COMMENT ON COLUMN public.repreneurs.ms_closing IS 'G3: Deal closed';
COMMENT ON COLUMN public.repreneurs.ms_plan_100_days IS 'G4: 100-day plan delivered';
COMMENT ON COLUMN public.repreneurs.ms_plan_3_years IS 'G4: 3-year value creation plan defined and piloted';

-- =====================
-- 4. UPDATE JOURNEY STAGE FUNCTION (group-based, not count-based)
-- =====================

CREATE OR REPLACE FUNCTION compute_journey_stage(
  milestone_count INTEGER,
  persona TEXT
) RETURNS TEXT AS $$
BEGIN
  -- This function is kept for backwards compat but the trigger now uses group logic directly
  -- It will only be called as a fallback
  IF milestone_count >= 18 THEN
    RETURN 'post_acquisition';
  ELSIF milestone_count >= 16 THEN
    RETURN 'execution';
  ELSIF milestone_count >= 9 THEN
    RETURN 'ready';
  ELSIF milestone_count >= 2 THEN
    RETURN 'learner';
  ELSE
    RETURN 'explorer';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================
-- 5. UPDATE TRIGGER (group-based derivation)
-- =====================

CREATE OR REPLACE FUNCTION update_journey_stage_trigger() RETURNS TRIGGER AS $$
DECLARE
  g1_complete BOOLEAN;
  g2_complete BOOLEAN;
  g3_complete BOOLEAN;
  g4_complete BOOLEAN;
BEGIN
  -- Count all 18 new milestones
  NEW.tier3_milestone_count := (
    -- Group 1: Explorer → Learner
    CASE WHEN NEW.ms_decision_to_pursue THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_availability_confirmed THEN 1 ELSE 0 END +
    -- Group 2: Learner → Ready
    CASE WHEN NEW.ms_target_profile_sheet THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_pitch_plan THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_equity_range THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_deal_breakers THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team_structured THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_leadership_assessment_passed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team_identified THEN 1 ELSE 0 END +
    -- Group 3: Ready → Execution
    CASE WHEN NEW.ms_intermediary_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_seller_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_loi_issued THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_due_diligence THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_negotiation THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_financing_validated THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_closing THEN 1 ELSE 0 END +
    -- Group 4: Execution → Post-acquisition
    CASE WHEN NEW.ms_plan_100_days THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_plan_3_years THEN 1 ELSE 0 END
  );

  -- Group-based stage derivation: ALL milestones in a group must be complete
  g1_complete := NEW.ms_decision_to_pursue AND NEW.ms_availability_confirmed;
  g2_complete := g1_complete AND NEW.ms_target_profile_sheet AND NEW.ms_pitch_plan
    AND NEW.ms_equity_range AND NEW.ms_deal_breakers AND NEW.ms_advisory_team_structured
    AND NEW.ms_leadership_assessment_passed AND NEW.ms_advisory_team_identified;
  g3_complete := g2_complete AND NEW.ms_intermediary_meeting AND NEW.ms_seller_meeting
    AND NEW.ms_loi_issued AND NEW.ms_due_diligence AND NEW.ms_negotiation
    AND NEW.ms_financing_validated AND NEW.ms_closing;
  g4_complete := g3_complete AND NEW.ms_plan_100_days AND NEW.ms_plan_3_years;

  -- Derive stage from group completion
  IF g4_complete THEN
    NEW.journey_stage := 'post_acquisition';
  ELSIF g3_complete THEN
    NEW.journey_stage := 'execution';
  ELSIF g2_complete THEN
    NEW.journey_stage := 'ready';
  ELSIF g1_complete THEN
    NEW.journey_stage := 'learner';
  ELSE
    NEW.journey_stage := 'explorer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- 6. RECALCULATE ALL EXISTING REPRENEURS
-- =====================

-- Touch all rows to fire the trigger and recalculate milestone count + journey stage
UPDATE public.repreneurs
SET ms_decision_to_pursue = COALESCE(ms_decision_to_pursue, FALSE)
WHERE TRUE;

-- =====================
-- 7. DOCUMENTATION
-- =====================

COMMENT ON FUNCTION compute_journey_stage IS 'V2: Group-based journey stage derivation. 5 stages: explorer, learner, ready, execution, post_acquisition';
