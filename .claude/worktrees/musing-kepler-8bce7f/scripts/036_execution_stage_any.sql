-- =====================
-- 036: Update journey stage derivation for Execution
--
-- Per Bertrand's feedback (2026-03-14):
-- Ready → Execution triggers when ANY Group 3 milestone is started
-- (not when ALL are complete). Execution is a process, not a gate.
-- Post-acquisition still requires ALL Group 3 + Group 4 complete.
-- =====================

CREATE OR REPLACE FUNCTION update_journey_stage_trigger() RETURNS TRIGGER AS $$
DECLARE
  g1_complete BOOLEAN;
  g2_complete BOOLEAN;
  g3_any BOOLEAN;
  g3_complete BOOLEAN;
  g4_complete BOOLEAN;
BEGIN
  -- Count all 18 new milestones
  NEW.tier3_milestone_count := (
    CASE WHEN NEW.ms_decision_to_pursue THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_availability_confirmed THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_target_profile_sheet THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_pitch_plan THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_equity_range THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_deal_breakers THEN 1 ELSE 0 END +
    CASE WHEN NEW.ms_advisory_team_structured THEN 1 ELSE 0 END +
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

  -- Group completion checks
  g1_complete := NEW.ms_decision_to_pursue AND NEW.ms_availability_confirmed;

  g2_complete := g1_complete AND NEW.ms_target_profile_sheet AND NEW.ms_pitch_plan
    AND NEW.ms_equity_range AND NEW.ms_deal_breakers AND NEW.ms_advisory_team_structured
    AND NEW.ms_leadership_assessment_passed AND NEW.ms_advisory_team_identified;

  -- Group 3: ANY milestone started = in execution
  g3_any := g2_complete AND (
    NEW.ms_intermediary_meeting OR NEW.ms_seller_meeting OR NEW.ms_loi_issued
    OR NEW.ms_due_diligence OR NEW.ms_negotiation OR NEW.ms_financing_validated
    OR NEW.ms_closing
  );

  -- Group 3: ALL complete (needed for post-acquisition)
  g3_complete := g2_complete AND NEW.ms_intermediary_meeting AND NEW.ms_seller_meeting
    AND NEW.ms_loi_issued AND NEW.ms_due_diligence AND NEW.ms_negotiation
    AND NEW.ms_financing_validated AND NEW.ms_closing;

  g4_complete := g3_complete AND NEW.ms_plan_100_days AND NEW.ms_plan_3_years;

  -- Derive stage
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
