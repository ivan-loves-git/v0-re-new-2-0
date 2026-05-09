-- Add flatchr_id column for tracking imported records
-- Run this BEFORE the flatchr-import.sql

ALTER TABLE repreneurs
ADD COLUMN IF NOT EXISTS flatchr_id TEXT UNIQUE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_repreneurs_flatchr_id ON repreneurs(flatchr_id);
