-- Add WHO/WHEN dual scoring columns to repreneurs table
-- Sprint 2: Database Schema for questionnaire-spec-v2
--
-- WHO Score: Profile quality (0-100) from Q05-Q10
-- WHEN Score: Project maturity (0-100) from Q11-Q16
--
-- These columns COEXIST with old tier1_score for backward compatibility.
-- Existing repreneurs keep their old scores; new ones get dual scores.

-- ========================================
-- WHO Question Answer Fields (Q05-Q10)
-- ========================================

-- Q05: Current professional status
-- Values: 'entrepreneur', 'freelance', 'employee', 'transition', 'other'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q05_status TEXT;

-- Q06: Years of professional experience
-- Values: 'more_than_20', '10_to_20', 'less_than_10'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q06_experience TEXT;

-- Q07: Leadership/management experience
-- Values: 'general_management', 'mgmt_over_10', 'mgmt_under_10', 'none'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q07_leadership TEXT;

-- Q08: Crisis management experience
-- Values: 'multiple', 'once', 'none'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q08_crisis TEXT;

-- Q09: Investment decision involvement
-- Values: 'both', 'personal', 'professional', 'none'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q09_investment TEXT;

-- Q10: Personal impact of professional decisions
-- Values: 'financial', 'trajectory', 'limited', 'none'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q10_impact TEXT;

-- ========================================
-- WHEN Question Answer Fields (Q11-Q16)
-- ========================================

-- Q11: Project status (multi-select, highest value counts)
-- Values: ['discovery', 'exploratory', 'framed', 'searching', 'loi']
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q11_project_status JSONB DEFAULT '[]'::jsonb;

-- Q12: Geographic zones (multi-select, no scoring)
-- Values: region identifiers like 'ile-de-france', 'all-france', etc.
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q12_geo_zones JSONB DEFAULT '[]'::jsonb;

-- Q13: Target sectors (multi-select, no scoring)
-- Values: sector identifiers like 'tech', 'industry', etc.
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q13_target_sectors_v2 JSONB DEFAULT '[]'::jsonb;

-- Q14: Target deal size (multi-select)
-- Values: ['1-3M', '3-5M', '>5M']
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q14_deal_size JSONB DEFAULT '[]'::jsonb;

-- Q15: Capital structure (multi-select)
-- Values: ['majority_without_fund', 'majority_with_minority', 'manager_with_majority', 'havent_thought']
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q15_structure JSONB DEFAULT '[]'::jsonb;

-- Q16: Personal equity contribution (single select)
-- Values: 'tbd', '151-250', '251-350', '351-450', '>450'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS q16_equity TEXT;

-- ========================================
-- Dual Score Results
-- ========================================

-- WHO score: Profile quality (0-100)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS who_score INTEGER;

-- WHEN score: Project maturity (0-100)
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS when_score INTEGER;

-- WHO score breakdown by question (for transparency/debugging)
-- Format: { "q05": 5, "q06": 15, "q07": 30, "q08": 20, "q09": 15, "q10": 15 }
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS who_score_breakdown JSONB;

-- WHEN score breakdown by component (for transparency/debugging)
-- Format: { "fitFinancier": 40, "clarity": 40, "projectStatus": 20 }
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS when_score_breakdown JSONB;

-- Active flags (override score-based recommendations)
-- Format: ["F1", "F3"] or []
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS scoring_flags JSONB DEFAULT '[]'::jsonb;

-- Recommended action based on scores and flags
-- Values: 'deal_flow', 'priority_interview', 'interview', 'starter_pack'
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- ========================================
-- Comments for Documentation
-- ========================================

COMMENT ON COLUMN public.repreneurs.q05_status IS 'Q05: Current professional status (WHO)';
COMMENT ON COLUMN public.repreneurs.q06_experience IS 'Q06: Years of professional experience (WHO)';
COMMENT ON COLUMN public.repreneurs.q07_leadership IS 'Q07: Leadership/management experience (WHO)';
COMMENT ON COLUMN public.repreneurs.q08_crisis IS 'Q08: Crisis management experience (WHO)';
COMMENT ON COLUMN public.repreneurs.q09_investment IS 'Q09: Investment decision involvement (WHO)';
COMMENT ON COLUMN public.repreneurs.q10_impact IS 'Q10: Personal impact of professional decisions (WHO)';

COMMENT ON COLUMN public.repreneurs.q11_project_status IS 'Q11: Project status multi-select (WHEN)';
COMMENT ON COLUMN public.repreneurs.q12_geo_zones IS 'Q12: Geographic zones multi-select (WHEN, no scoring)';
COMMENT ON COLUMN public.repreneurs.q13_target_sectors_v2 IS 'Q13: Target sectors multi-select v2 (WHEN, no scoring)';
COMMENT ON COLUMN public.repreneurs.q14_deal_size IS 'Q14: Target deal size multi-select (WHEN)';
COMMENT ON COLUMN public.repreneurs.q15_structure IS 'Q15: Capital structure multi-select (WHEN)';
COMMENT ON COLUMN public.repreneurs.q16_equity IS 'Q16: Personal equity contribution (WHEN)';

COMMENT ON COLUMN public.repreneurs.who_score IS 'WHO score: Profile quality (0-100) from Q05-Q10';
COMMENT ON COLUMN public.repreneurs.when_score IS 'WHEN score: Project maturity (0-100) from Q11-Q16';
COMMENT ON COLUMN public.repreneurs.who_score_breakdown IS 'WHO score breakdown by question (JSON)';
COMMENT ON COLUMN public.repreneurs.when_score_breakdown IS 'WHEN score breakdown by component (JSON)';
COMMENT ON COLUMN public.repreneurs.scoring_flags IS 'Active warning flags that override recommendations (JSON array)';
COMMENT ON COLUMN public.repreneurs.recommendation IS 'Recommended action: deal_flow, priority_interview, interview, starter_pack';
