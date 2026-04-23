-- Questionnaire V3: add "Pour vous la reprise est ?" question
--
-- Bertrand asked for an early filter: repreneurs who say acquisition is
-- one option among others score -10 on WHEN. The same change also adds the
-- -10 penalty when "projet cadré" is selected without a fiche de cadrage
-- (no new column — logic reads existing ldc_url), and relabels the <150 K€
-- equity option (no enum change, just the displayed label).
--
-- Retroactive protection: all new penalties only apply when this column is
-- set (i.e. the record went through the v3 questionnaire). Old records
-- keep their original scores.

ALTER TABLE repreneurs
  ADD COLUMN IF NOT EXISTS q11_priority_choice TEXT
    CHECK (q11_priority_choice IS NULL OR q11_priority_choice IN ('preferred', 'one_among_others'));

COMMENT ON COLUMN repreneurs.q11_priority_choice IS
  'Q11 v3: whether SME acquisition is the repreneur preferred career path or one option among others. -10 WHEN penalty if one_among_others.';

-- q17_current_needs was captured in the v2 intake form but never persisted.
-- Storing it here so it can render on the repreneur profile.
ALTER TABLE repreneurs
  ADD COLUMN IF NOT EXISTS q17_current_needs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN repreneurs.q17_current_needs IS
  'Q18 in Notion spec (code: q17): current needs multi-select — project launch, deal access, partner access, financing, other support.';
