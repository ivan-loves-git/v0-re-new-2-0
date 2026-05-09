-- Migration 020: Add Tier 3 Readiness Milestones
-- 10 milestone checkboxes for tracking acquisition readiness

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

-- All milestones start as FALSE - team checks manually based on their knowledge
-- No auto-seeding from existing data
