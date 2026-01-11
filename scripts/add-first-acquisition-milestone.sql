-- =============================================================================
-- ADD FIRST ACQUISITION MILESTONE
-- =============================================================================
-- Adds the 11th milestone "first_acquisition" for Serial Acquirer status
-- Serial Acquirer now requires all 11 milestones (no persona check)
-- =============================================================================

-- Add the new milestone column
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS ms_first_acquisition BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.repreneurs.ms_first_acquisition IS 'Milestone 11: First acquisition completed - successfully acquired at least one company';

-- Update the journey stage computation function (no longer needs persona)
CREATE OR REPLACE FUNCTION compute_journey_stage(
  milestone_count INTEGER,
  persona TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Serial Acquirer: All 11 milestones completed
  IF milestone_count >= 11 THEN
    RETURN 'serial_acquirer';
  -- Ready: 7-10 milestones
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

-- Update the trigger to count 11 milestones
CREATE OR REPLACE FUNCTION update_journey_stage_trigger() RETURNS TRIGGER AS $$
BEGIN
  -- Count completed milestones (now 11 total)
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
    CASE WHEN NEW.ms_dd_checklist THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_first_acquisition THEN 1 ELSE 0 END
  );

  -- Derive journey stage from milestone count (persona no longer used)
  NEW.journey_stage := compute_journey_stage(
    NEW.tier3_milestone_count,
    NEW.persona
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update all existing repreneurs to recalculate (trigger will fire)
UPDATE public.repreneurs
SET ms_first_acquisition = COALESCE(ms_first_acquisition, FALSE)
WHERE TRUE;

-- Add comment
COMMENT ON FUNCTION compute_journey_stage IS 'Derives journey stage from milestone count: 0-2=explorer, 3-6=learner, 7-10=ready, 11=serial_acquirer';
