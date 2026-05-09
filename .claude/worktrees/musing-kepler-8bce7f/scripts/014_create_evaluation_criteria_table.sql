-- Migration: Create evaluation criteria table
-- Run this in Supabase SQL Editor
-- This stores the editable evaluation criteria for Tier 1, 2, 3 scoring

-- =============================================
-- 1. Evaluation Criteria Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tier identification
  tier TEXT NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3')),

  -- Question identification
  question_key TEXT NOT NULL,           -- e.g., 'q1_employment_status'
  question_label TEXT NOT NULL,         -- e.g., 'Statut professionnel actuel'
  question_order INTEGER NOT NULL,      -- Display order (1, 2, 3...)

  -- Option details (for questions with predefined answers)
  option_value TEXT,                    -- e.g., 'sans_emploi' (NULL for boolean questions)
  option_label TEXT,                    -- e.g., 'Sans emploi'
  option_score NUMERIC(5, 2),           -- e.g., 10.00, 7.50
  option_order INTEGER,                 -- Display order within question

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT unique_tier_question_option UNIQUE (tier, question_key, option_value),
  CONSTRAINT score_range CHECK (option_score IS NULL OR (option_score >= 0 AND option_score <= 20))
);

-- Comments for documentation
COMMENT ON TABLE public.evaluation_criteria IS 'Editable evaluation criteria for scoring repreneurs (Tier 1, 2, 3)';
COMMENT ON COLUMN public.evaluation_criteria.tier IS 'Which tier: tier1, tier2, tier3';
COMMENT ON COLUMN public.evaluation_criteria.question_key IS 'Matches questionnaire field (e.g., q1_employment_status)';
COMMENT ON COLUMN public.evaluation_criteria.question_label IS 'Display label shown to users';
COMMENT ON COLUMN public.evaluation_criteria.option_value IS 'Option value stored in database (NULL for boolean/text questions)';
COMMENT ON COLUMN public.evaluation_criteria.option_label IS 'Display label for the option';
COMMENT ON COLUMN public.evaluation_criteria.option_score IS 'Points awarded for this option';

-- =============================================
-- 2. Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_tier
  ON public.evaluation_criteria(tier);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_question_key
  ON public.evaluation_criteria(question_key);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_active
  ON public.evaluation_criteria(is_active)
  WHERE is_active = true;

-- =============================================
-- 3. Enable RLS
-- =============================================
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. RLS Policies
-- =============================================

-- All authenticated users can view criteria
CREATE POLICY "Users can view evaluation criteria"
  ON public.evaluation_criteria
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- All authenticated users can update criteria
CREATE POLICY "Users can update evaluation criteria"
  ON public.evaluation_criteria
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- 5. Updated_at Trigger
-- =============================================
CREATE TRIGGER update_evaluation_criteria_updated_at
  BEFORE UPDATE ON public.evaluation_criteria
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
