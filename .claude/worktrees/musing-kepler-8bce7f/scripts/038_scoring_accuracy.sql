-- Migration 038: Add scoring accuracy ratings
-- When: April 2026
-- Why: Post-interview manual accuracy rating for WHO/WHEN scores (Bertrand backlog P2)

ALTER TABLE repreneurs
  ADD COLUMN IF NOT EXISTS who_accuracy VARCHAR(20),
  ADD COLUMN IF NOT EXISTS when_accuracy VARCHAR(20),
  ADD COLUMN IF NOT EXISTS accuracy_notes TEXT,
  ADD COLUMN IF NOT EXISTS accuracy_rated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accuracy_rated_by TEXT;

-- Drop the old unused boolean flag
ALTER TABLE repreneurs
  DROP COLUMN IF EXISTS scoring_accuracy_flag;
