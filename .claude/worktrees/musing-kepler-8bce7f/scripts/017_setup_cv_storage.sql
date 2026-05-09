-- Migration: Setup CVs storage bucket in Supabase
-- Purpose: Store CV documents for repreneurs
-- Note: Run this in Supabase SQL Editor

-- Create the cvs bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view CVs (public bucket)
CREATE POLICY "Anyone can view CVs"
ON storage.objects FOR SELECT
USING (bucket_id = 'cvs');

-- Policy: Authenticated users can upload CVs
CREATE POLICY "Authenticated users can upload CVs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cvs'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can update CVs
CREATE POLICY "Authenticated users can update CVs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cvs'
  AND auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete CVs
CREATE POLICY "Authenticated users can delete CVs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cvs'
  AND auth.role() = 'authenticated'
);
