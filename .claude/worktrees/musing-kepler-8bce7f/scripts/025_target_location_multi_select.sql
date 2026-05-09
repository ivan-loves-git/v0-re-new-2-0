-- Migration: Convert target_location from TEXT to JSONB array
-- This allows repreneurs to select multiple target regions
-- Date: 2026-01-20

-- Step 1: Add a new temporary JSONB column
ALTER TABLE repreneurs ADD COLUMN IF NOT EXISTS target_location_new JSONB;

-- Step 2: Migrate existing data (convert single text value to array)
-- If target_location is not null, wrap it in a JSONB array
UPDATE repreneurs
SET target_location_new = CASE
    WHEN target_location IS NOT NULL AND target_location != '' THEN
        jsonb_build_array(target_location)
    ELSE
        NULL
END;

-- Step 3: Drop the old column
ALTER TABLE repreneurs DROP COLUMN target_location;

-- Step 4: Rename the new column to the original name
ALTER TABLE repreneurs RENAME COLUMN target_location_new TO target_location;

-- Step 5: Add a comment to document the change
COMMENT ON COLUMN repreneurs.target_location IS 'JSONB array of target region codes (multi-select)';
