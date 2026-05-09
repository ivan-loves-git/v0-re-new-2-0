-- =============================================================================
-- MIGRATION 034: Leadership Assessment Table
-- =============================================================================
-- 26-question assessment: Bloc A (10 binary), Bloc B (8 scenarios), Bloc C (8 Likert)
-- Token-based public access (repreneur takes via link, no auth needed)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leadership_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id UUID NOT NULL REFERENCES public.repreneurs(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,

  -- Bloc A answers (10 binary A/B)
  a1 TEXT CHECK (a1 IN ('A', 'B')),
  a2 TEXT CHECK (a2 IN ('A', 'B')),
  a3 TEXT CHECK (a3 IN ('A', 'B')),
  a4 TEXT CHECK (a4 IN ('A', 'B')),
  a5 TEXT CHECK (a5 IN ('A', 'B')),
  a6 TEXT CHECK (a6 IN ('A', 'B')),
  a7 TEXT CHECK (a7 IN ('A', 'B')),
  a8 TEXT CHECK (a8 IN ('A', 'B')),
  a9 TEXT CHECK (a9 IN ('A', 'B')),
  a10 TEXT CHECK (a10 IN ('A', 'B')),

  -- Bloc B answers (8 scenarios, 4 options)
  b1 TEXT CHECK (b1 IN ('A', 'B', 'C', 'D')),
  b2 TEXT CHECK (b2 IN ('A', 'B', 'C', 'D')),
  b3 TEXT CHECK (b3 IN ('A', 'B', 'C', 'D')),
  b4 TEXT CHECK (b4 IN ('A', 'B', 'C', 'D')),
  b5 TEXT CHECK (b5 IN ('A', 'B', 'C', 'D')),
  b6 TEXT CHECK (b6 IN ('A', 'B', 'C', 'D')),
  b7 TEXT CHECK (b7 IN ('A', 'B', 'C', 'D')),
  b8 TEXT CHECK (b8 IN ('A', 'B', 'C', 'D')),

  -- Bloc C answers (8 Likert 1-5)
  c1 INTEGER CHECK (c1 BETWEEN 1 AND 5),
  c2 INTEGER CHECK (c2 BETWEEN 1 AND 5),
  c3 INTEGER CHECK (c3 BETWEEN 1 AND 5),
  c4 INTEGER CHECK (c4 BETWEEN 1 AND 5),
  c5 INTEGER CHECK (c5 BETWEEN 1 AND 5),
  c6 INTEGER CHECK (c6 BETWEEN 1 AND 5),
  c7 INTEGER CHECK (c7 BETWEEN 1 AND 5),
  c8 INTEGER CHECK (c8 BETWEEN 1 AND 5),

  -- Computed scores (filled on submit)
  bloc_a_radar JSONB,
  bloc_b_total INTEGER,
  bloc_b_tags JSONB,
  bloc_b_minus2_count INTEGER,
  bloc_c_risk_index NUMERIC(3,1),
  decision TEXT CHECK (decision IN ('engagement', 'engagement_sous_conditions', 'non_engagement')),

  -- Metadata
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID
);

-- Index for token lookups (public form access)
CREATE INDEX IF NOT EXISTS idx_assessment_token ON public.leadership_assessments(token);

-- Index for repreneur lookups
CREATE INDEX IF NOT EXISTS idx_assessment_repreneur ON public.leadership_assessments(repreneur_id);

-- Add reference column on repreneurs
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS leadership_assessment_id UUID REFERENCES public.leadership_assessments(id);

COMMENT ON TABLE public.leadership_assessments IS 'Leadership potential assessment: 26 questions across 3 blocks (profile, scenarios, self-assessment)';
