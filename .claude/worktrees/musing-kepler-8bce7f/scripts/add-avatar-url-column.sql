-- Add avatar_url column to repreneurs table
-- Run this in Supabase SQL Editor

ALTER TABLE repreneurs
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN repreneurs.avatar_url IS 'URL to custom avatar image in Supabase Storage';
