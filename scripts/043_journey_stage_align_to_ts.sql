-- =====================
-- 043: Align journey_stage SQL trigger to TypeScript contract (17 milestones)
--
-- BUG: Migrations 033 + 036 included `ms_advisory_team_structured` in
-- `g2_complete` and in the milestone count. The TypeScript layer
-- (lib/utils/journey-derivation.ts) and the entire UI use 17 milestones
-- and never reference `ms_advisory_team_structured`. Result: the column
-- stays FALSE for every repreneur, the trigger fails `g2_complete`, and
-- the BEFORE-INSERT/UPDATE trigger demotes everyone to `learner` even
-- when they have LOI / DD / etc. in flight.
--
-- 28 of 167 active repreneurs were stuck (e.g. Jacques Gout-Lombard,
-- Guillaume de Prunelé) — confirmed via audit on 2026-05-09.
--
-- This migration:
--   1. Replaces update_journey_stage_trigger() to count 17 milestones
--      and drop ms_advisory_team_structured from g2_complete.
--   2. Forces a recompute on all active rows by firing a no-op UPDATE,
--      with the updated_at trigger temporarily disabled so Wavy
--      "stalest first" ordering is preserved.
--
-- The ms_advisory_team_structured column is left in place (no UI / TS
-- references; safe to ignore — drop in a future cleanup if desired).
-- =====================

CREATE OR REPLACE FUNCTION update_journey_stage_trigger() RETURNS TRIGGER AS $$
DECLARE
  g1_complete BOOLEAN;
  g2_complete BOOLEAN;
  g3_any BOOLEAN;
  g3_complete BOOLEAN;
  g4_complete BOOLEAN;
BEGIN
  -- Count 17 milestones (matches lib/utils/journey-derivation.ts MILESTONE_KEYS)
  NEW.tier3_milestone_count := (
    CASE WHEN NEW.ms_decision_to_pursue THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_availability_confirmed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_target_profile_sheet THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_pitch_plan THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_equity_range THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_deal_breakers THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_leadership_assessment_passed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team_identified THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_intermediary_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_seller_meeting THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_loi_issued THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_due_diligence THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_negotiation THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_financing_validated THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_closing THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_plan_100_days THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_plan_3_years THEN 1 ELSE 0 END
  );

  g1_complete := NEW.ms_decision_to_pursue AND NEW.ms_availability_confirmed;

  -- Group 2 = 6 milestones (NO ms_advisory_team_structured)
  g2_complete := g1_complete
    AND NEW.ms_target_profile_sheet AND NEW.ms_pitch_plan
    AND NEW.ms_equity_range AND NEW.ms_deal_breakers
    AND NEW.ms_leadership_assessment_passed AND NEW.ms_advisory_team_identified;

  g3_any := g2_complete AND (
    NEW.ms_intermediary_meeting OR NEW.ms_seller_meeting OR NEW.ms_loi_issued
    OR NEW.ms_due_diligence OR NEW.ms_negotiation OR NEW.ms_financing_validated
    OR NEW.ms_closing
  );

  g3_complete := g2_complete AND NEW.ms_intermediary_meeting AND NEW.ms_seller_meeting
    AND NEW.ms_loi_issued AND NEW.ms_due_diligence AND NEW.ms_negotiation
    AND NEW.ms_financing_validated AND NEW.ms_closing;

  g4_complete := g3_complete AND NEW.ms_plan_100_days AND NEW.ms_plan_3_years;

  IF g4_complete THEN
    NEW.journey_stage := 'post_acquisition';
  ELSIF g3_any THEN
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

-- Recompute existing rows. Disable updated_at trigger so Wavy stalest-first
-- ordering (lib/actions/wavy.ts, app/api/wavy/suggestions/route.ts) is preserved.
ALTER TABLE public.repreneurs DISABLE TRIGGER update_repreneurs_updated_at;

UPDATE public.repreneurs
SET id = id
WHERE rejected_at IS NULL;

ALTER TABLE public.repreneurs ENABLE TRIGGER update_repreneurs_updated_at;
