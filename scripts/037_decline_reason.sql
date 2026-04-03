-- Migration 037: Add decline reason fields
-- When: April 2026
-- Why: Capture why repreneurs decline offers (Bertrand backlog P0)

ALTER TABLE repreneurs
  ADD COLUMN IF NOT EXISTS decline_reason_category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS decline_reason_text TEXT;
