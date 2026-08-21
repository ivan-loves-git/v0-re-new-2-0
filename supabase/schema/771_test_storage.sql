-- Test-safe private storage setup for release build 771.
-- These are fixed empty infrastructure records, never copied production data.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cvs', 'cvs', false),
  ('opportunity-documents', 'opportunity-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Released build 771 denies direct browser access to both sensitive buckets.
DROP POLICY IF EXISTS "Anyone can view CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON storage.objects;
