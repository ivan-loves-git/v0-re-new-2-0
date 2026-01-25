-- Migrate legacy questionnaire data to v2 dual scoring fields
-- Sprint 6, Task 6.1: Legacy Data Mapping Script
--
-- This script maps existing Q1-Q17 questionnaire data to new Q05-Q16 fields
-- where possible. Fields that can't be mapped remain NULL.
--
-- IMPORTANT: Run this ONCE after applying 027_add_dual_scoring_columns.sql
-- This does NOT calculate scores - manual data completion is required for unmappable fields.

-- ========================================
-- Step 1: Add needs_data_completion flag
-- ========================================

-- Flag to indicate legacy repreneurs who need manual data entry
-- to complete their dual scoring profile
ALTER TABLE public.repreneurs
ADD COLUMN IF NOT EXISTS needs_data_completion BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.repreneurs.needs_data_completion IS
  'True if repreneur was imported from legacy system and needs manual data entry for dual scoring';

-- ========================================
-- Step 2: Map Q1 Employment Status → Q05 Status
-- ========================================

-- Legacy q1_employment_status values to v2 q05_status mapping:
-- 'employed' → 'employee'
-- 'self_employed' → 'freelance'
-- 'business_owner' → 'entrepreneur'
-- 'unemployed' → 'transition'
-- 'retired' → 'other'
-- NULL stays NULL (unmappable)

UPDATE public.repreneurs
SET q05_status = CASE
    WHEN q1_employment_status = 'employed' THEN 'employee'
    WHEN q1_employment_status = 'self_employed' THEN 'freelance'
    WHEN q1_employment_status = 'business_owner' THEN 'entrepreneur'
    WHEN q1_employment_status = 'unemployed' THEN 'transition'
    WHEN q1_employment_status = 'retired' THEN 'other'
    WHEN q1_employment_status IS NOT NULL THEN 'other'  -- Catch any other values
    ELSE NULL
END
WHERE q05_status IS NULL
  AND q1_employment_status IS NOT NULL;

-- ========================================
-- Step 3: Map Q2 Years Experience → Q06 Experience
-- ========================================

-- Legacy q2_years_experience values to v2 q06_experience mapping:
-- Try to extract year ranges and map to buckets
-- '20+', '20_plus', 'more_than_20' → 'more_than_20'
-- '10-20', '10_to_20' → '10_to_20'
-- '<10', 'less_than_10', '5-10', '0-5' → 'less_than_10'
-- NULL stays NULL

UPDATE public.repreneurs
SET q06_experience = CASE
    WHEN q2_years_experience IN ('20+', '20_plus', 'more_than_20', '25+', '30+') THEN 'more_than_20'
    WHEN q2_years_experience IN ('10-20', '10_to_20', '15-20', '10-15') THEN '10_to_20'
    WHEN q2_years_experience IN ('<10', 'less_than_10', '5-10', '0-5', '0-10', '<5') THEN 'less_than_10'
    ELSE NULL  -- Can't map
END
WHERE q06_experience IS NULL
  AND q2_years_experience IS NOT NULL;

-- ========================================
-- Step 4: Approximate Q07 Leadership from Q5 + Q8
-- ========================================

-- Q07 Leadership requires combining:
-- - q5_team_size (how many people managed)
-- - q8_executive_roles (what level of management)
--
-- This is an APPROXIMATION - manual review recommended
--
-- Mapping logic:
-- - If has executive roles like 'ceo', 'general_manager' → 'general_management'
-- - If team_size > 10 OR has director-level roles → 'mgmt_over_10'
-- - If team_size <= 10 AND has manager roles → 'mgmt_under_10'
-- - If no management experience → 'none'

UPDATE public.repreneurs
SET q07_leadership = CASE
    -- Check for general management roles
    WHEN q8_executive_roles::text ILIKE '%ceo%'
      OR q8_executive_roles::text ILIKE '%general_manager%'
      OR q8_executive_roles::text ILIKE '%managing_director%'
      OR q8_executive_roles::text ILIKE '%president%'
    THEN 'general_management'

    -- Check for large team management
    WHEN q5_team_size IN ('50+', '100+', '20-50', '10-20', '11-50')
      OR q8_executive_roles::text ILIKE '%director%'
      OR q8_executive_roles::text ILIKE '%vp%'
    THEN 'mgmt_over_10'

    -- Check for small team management
    WHEN q5_team_size IN ('5-10', '1-5', '1-10', '<10')
      OR q8_executive_roles::text ILIKE '%manager%'
      OR q8_executive_roles::text ILIKE '%supervisor%'
    THEN 'mgmt_under_10'

    -- Check for any management indication
    WHEN q5_team_size IS NOT NULL AND q5_team_size != '0' AND q5_team_size != 'none'
    THEN 'mgmt_under_10'

    -- No management experience
    WHEN q5_team_size IN ('0', 'none', 'n/a')
      OR (q8_executive_roles IS NULL AND q5_team_size IS NULL)
    THEN NULL  -- Leave as unknown, not 'none' (to be safe)

    ELSE NULL
END
WHERE q07_leadership IS NULL
  AND (q5_team_size IS NOT NULL OR q8_executive_roles IS NOT NULL);

-- ========================================
-- Step 5: Map Q14 Investment Capacity → Q16 Equity
-- ========================================

-- Legacy q14_investment_capacity to v2 q16_equity mapping:
-- Try to extract amounts and map to buckets (in thousands €)
-- '<150k', '<150' → 'tbd' (below minimum threshold)
-- '150-250k', '150-250' → '151-250'
-- '250-350k', '250-350' → '251-350'
-- '350-450k', '350-450' → '351-450'
-- '>450k', '450+', '>500k' → '>450'
-- NULL stays NULL

UPDATE public.repreneurs
SET q16_equity = CASE
    WHEN q14_investment_capacity IN ('<150k', '<150', '0-100k', '0-150k', '<100k', 'tbd', 'unknown') THEN 'tbd'
    WHEN q14_investment_capacity IN ('150-250k', '150-250', '100-250k', '150k-250k') THEN '151-250'
    WHEN q14_investment_capacity IN ('250-350k', '250-350', '250k-350k', '200-400k') THEN '251-350'
    WHEN q14_investment_capacity IN ('350-450k', '350-450', '350k-450k', '300-500k') THEN '351-450'
    WHEN q14_investment_capacity IN ('>450k', '450+', '>500k', '500k+', '>450', '450k+', '>1M') THEN '>450'
    ELSE NULL  -- Can't map
END
WHERE q16_equity IS NULL
  AND q14_investment_capacity IS NOT NULL;

-- ========================================
-- Step 6: Map Q11 Target Sectors → Q13 Target Sectors v2
-- ========================================

-- Copy existing sector preferences to new v2 field
-- (These are informational, not scored)

UPDATE public.repreneurs
SET q13_target_sectors_v2 = COALESCE(q11_target_sectors::jsonb, '[]'::jsonb)
WHERE q13_target_sectors_v2 = '[]'::jsonb
  AND q11_target_sectors IS NOT NULL;

-- ========================================
-- Step 7: Map Target Location → Q12 Geo Zones
-- ========================================

-- Copy existing target_location to new geo zones field
-- (These are informational, not scored)

UPDATE public.repreneurs
SET q12_geo_zones = COALESCE(target_location::jsonb, '[]'::jsonb)
WHERE q12_geo_zones = '[]'::jsonb
  AND target_location IS NOT NULL;

-- ========================================
-- Step 8: Mark legacy repreneurs as needing completion
-- ========================================

-- All repreneurs WITHOUT who_score or when_score need manual data completion
-- (they either came from legacy system or haven't done the v2 intake)

UPDATE public.repreneurs
SET needs_data_completion = true
WHERE (who_score IS NULL OR when_score IS NULL)
  AND questionnaire_completed_at IS NOT NULL;  -- Only if they did old questionnaire

-- ========================================
-- Step 9: Report migration results
-- ========================================

-- Show counts of what was migrated
SELECT
  'Total repreneurs' as metric,
  COUNT(*) as count
FROM public.repreneurs
UNION ALL
SELECT
  'With legacy questionnaire',
  COUNT(*)
FROM public.repreneurs WHERE questionnaire_completed_at IS NOT NULL
UNION ALL
SELECT
  'Migrated q05_status',
  COUNT(*)
FROM public.repreneurs WHERE q05_status IS NOT NULL
UNION ALL
SELECT
  'Migrated q06_experience',
  COUNT(*)
FROM public.repreneurs WHERE q06_experience IS NOT NULL
UNION ALL
SELECT
  'Migrated q07_leadership',
  COUNT(*)
FROM public.repreneurs WHERE q07_leadership IS NOT NULL
UNION ALL
SELECT
  'Migrated q16_equity',
  COUNT(*)
FROM public.repreneurs WHERE q16_equity IS NOT NULL
UNION ALL
SELECT
  'Needs data completion',
  COUNT(*)
FROM public.repreneurs WHERE needs_data_completion = true
UNION ALL
SELECT
  'Has dual scores',
  COUNT(*)
FROM public.repreneurs WHERE who_score IS NOT NULL AND when_score IS NOT NULL;

-- ========================================
-- UNMAPPABLE FIELDS (require manual entry)
-- ========================================
-- q08_crisis (Crisis management experience)
-- q09_investment (Investment decision involvement)
-- q10_impact (Personal impact of decisions)
-- q11_project_status (Project status multi-select)
-- q14_deal_size (Target deal size)
-- q15_structure (Capital structure preference)
--
-- These fields have no equivalent in legacy Q1-Q17 questionnaire
-- Repreneurs with needs_data_completion=true should be prompted
-- to complete these via the internal questionnaire form
