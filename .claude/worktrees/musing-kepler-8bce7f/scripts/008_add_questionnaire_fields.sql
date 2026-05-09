-- Add questionnaire fields to repreneurs table for Tier 1 scoring
-- These fields capture the intake questionnaire data (Q1-Q17)
-- Score is calculated once at intake and stored as a static snapshot

-- Q1: Employment status
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q1_employment_status TEXT;

-- Q2: Years of experience
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q2_years_experience TEXT;

-- Q3: Industry sectors (stored as JSON array)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q3_industry_sectors JSONB DEFAULT '[]'::jsonb;

-- Q4: Has M&A experience
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q4_has_ma_experience BOOLEAN;

-- Q5: Team size managed
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q5_team_size TEXT;

-- Q6: Involved in M&A transactions
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q6_involved_in_ma BOOLEAN;

-- Q7: M&A details (free text)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q7_ma_details TEXT;

-- Q8: Executive roles (stored as JSON array)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q8_executive_roles JSONB DEFAULT '[]'::jsonb;

-- Q9: Board experience
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q9_board_experience BOOLEAN;

-- Q10: Journey stages (stored as JSON array)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q10_journey_stages JSONB DEFAULT '[]'::jsonb;

-- Q11: Target sectors (stored as JSON array)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q11_target_sectors JSONB DEFAULT '[]'::jsonb;

-- Q12: Has identified specific targets
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q12_has_identified_targets BOOLEAN;

-- Q13: Target details (free text)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q13_target_details TEXT;

-- Q14: Investment capacity
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q14_investment_capacity TEXT;

-- Q15: Funding status
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q15_funding_status TEXT;

-- Q16: Network/training (stored as JSON array)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q16_network_training JSONB DEFAULT '[]'::jsonb;

-- Q17: Open to co-acquisition
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q17_open_to_co_acquisition BOOLEAN;

-- Store the score breakdown as JSON for transparency/debugging
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS tier1_score_breakdown JSONB;

-- Track when the questionnaire was completed
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN public.repreneurs.q1_employment_status IS 'Q1: Current employment status';
COMMENT ON COLUMN public.repreneurs.q2_years_experience IS 'Q2: Years of professional experience';
COMMENT ON COLUMN public.repreneurs.q3_industry_sectors IS 'Q3: Industry sectors of experience (JSON array)';
COMMENT ON COLUMN public.repreneurs.q4_has_ma_experience IS 'Q4: Has M&A experience';
COMMENT ON COLUMN public.repreneurs.q5_team_size IS 'Q5: Largest team size managed';
COMMENT ON COLUMN public.repreneurs.q6_involved_in_ma IS 'Q6: Directly involved in M&A transactions';
COMMENT ON COLUMN public.repreneurs.q7_ma_details IS 'Q7: Details of M&A experience (free text)';
COMMENT ON COLUMN public.repreneurs.q8_executive_roles IS 'Q8: Executive roles held (JSON array)';
COMMENT ON COLUMN public.repreneurs.q9_board_experience IS 'Q9: Has board/advisory experience';
COMMENT ON COLUMN public.repreneurs.q10_journey_stages IS 'Q10: Current journey stages (JSON array)';
COMMENT ON COLUMN public.repreneurs.q11_target_sectors IS 'Q11: Target acquisition sectors (JSON array)';
COMMENT ON COLUMN public.repreneurs.q12_has_identified_targets IS 'Q12: Has identified specific acquisition targets';
COMMENT ON COLUMN public.repreneurs.q13_target_details IS 'Q13: Details of identified targets (free text)';
COMMENT ON COLUMN public.repreneurs.q14_investment_capacity IS 'Q14: Investment capacity range';
COMMENT ON COLUMN public.repreneurs.q15_funding_status IS 'Q15: Funding status';
COMMENT ON COLUMN public.repreneurs.q16_network_training IS 'Q16: Network/training affiliations (JSON array)';
COMMENT ON COLUMN public.repreneurs.q17_open_to_co_acquisition IS 'Q17: Open to co-acquisition';
COMMENT ON COLUMN public.repreneurs.tier1_score_breakdown IS 'Breakdown of Tier 1 score by question (JSON)';
COMMENT ON COLUMN public.repreneurs.questionnaire_completed_at IS 'When the intake questionnaire was completed';
