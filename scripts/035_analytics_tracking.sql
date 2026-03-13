-- =============================================================================
-- MIGRATION 035: Analytics Tracking Fields
-- =============================================================================
-- Add date tracking fields for speed KPIs (filled by team going forward)
-- Add scoring accuracy feedback fields
-- =============================================================================

ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS first_contact_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_meeting_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qualification_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scoring_accuracy_flag BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scoring_accuracy_notes TEXT;

COMMENT ON COLUMN public.repreneurs.first_contact_date IS 'When the team first contacted this repreneur';
COMMENT ON COLUMN public.repreneurs.first_meeting_date IS 'When the first meeting was held';
COMMENT ON COLUMN public.repreneurs.qualification_date IS 'When the repreneur was qualified';
COMMENT ON COLUMN public.repreneurs.scoring_accuracy_flag IS 'Team feedback: was the automated scoring accurate? NULL=not reviewed';
COMMENT ON COLUMN public.repreneurs.scoring_accuracy_notes IS 'Team notes on scoring accuracy (when flag is false)';
