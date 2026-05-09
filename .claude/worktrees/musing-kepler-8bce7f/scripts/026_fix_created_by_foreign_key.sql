-- Migration: Fix created_by foreign key constraint
-- The created_by field was referencing auth.users (Supabase Auth)
-- but we now use Better Auth which has its own user table.
-- Better Auth uses TEXT for user.id while created_by is UUID, so we need to:
-- 1. Drop the old FK constraint
-- 2. Change the column type to TEXT to match Better Auth
-- Date: 2026-01-20

-- Step 1: Drop the foreign key constraints
ALTER TABLE repreneur_offers
DROP CONSTRAINT IF EXISTS repreneur_offers_created_by_fkey;

ALTER TABLE offer_milestones
DROP CONSTRAINT IF EXISTS offer_milestones_created_by_fkey;

-- Step 2: Change column type from UUID to TEXT to match Better Auth user.id
ALTER TABLE repreneur_offers
ALTER COLUMN created_by TYPE TEXT;

ALTER TABLE offer_milestones
ALTER COLUMN created_by TYPE TEXT;

-- Step 3: Add comment to document the change
COMMENT ON COLUMN repreneur_offers.created_by IS 'Better Auth user ID (TEXT, no FK constraint due to type mismatch)';
COMMENT ON COLUMN offer_milestones.created_by IS 'Better Auth user ID (TEXT, no FK constraint due to type mismatch)';
