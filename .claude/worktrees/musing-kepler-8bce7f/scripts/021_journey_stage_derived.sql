-- Migration 021: Journey Stage Derivation
-- Auto-derive journey_stage from milestone count (no manual override)

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
