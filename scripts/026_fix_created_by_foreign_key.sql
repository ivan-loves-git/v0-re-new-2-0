-- Migration: Fix created_by foreign key constraint
-- The created_by field was referencing auth.users (Supabase Auth)
-- but we now use Better Auth which has its own user table.
-- Date: 2026-01-20

-- Step 1: Drop the foreign key constraint on repreneur_offers.created_by
ALTER TABLE repreneur_offers
DROP CONSTRAINT IF EXISTS repreneur_offers_created_by_fkey;

-- Step 2: Drop the foreign key constraint on offer_milestones.created_by (if it exists)
ALTER TABLE offer_milestones
DROP CONSTRAINT IF EXISTS offer_milestones_created_by_fkey;

-- Step 3: Add a new foreign key constraint referencing the Better Auth user table
-- Note: Better Auth creates a "user" table (not auth.users)
ALTER TABLE repreneur_offers
ADD CONSTRAINT repreneur_offers_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.user(id) ON DELETE SET NULL;

ALTER TABLE offer_milestones
ADD CONSTRAINT offer_milestones_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.user(id) ON DELETE SET NULL;

-- Step 4: Add comment to document the change
COMMENT ON COLUMN repreneur_offers.created_by IS 'References Better Auth user table (public.user)';
COMMENT ON COLUMN offer_milestones.created_by IS 'References Better Auth user table (public.user)';
