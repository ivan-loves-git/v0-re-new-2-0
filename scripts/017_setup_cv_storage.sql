-- Migration: Setup CVs storage bucket in Supabase
-- Purpose: Store CV documents for repreneurs
-- Note: Run this in Supabase SQL Editor

-- Create the cvs bucket (private read, application-controlled writes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = false
WHERE id = 'cvs';
