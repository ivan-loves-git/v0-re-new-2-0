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
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "W-148 deny browser cvs select" ON storage.objects;
DROP POLICY IF EXISTS "W-148 deny browser cvs insert" ON storage.objects;
DROP POLICY IF EXISTS "W-148 deny browser cvs update" ON storage.objects;
DROP POLICY IF EXISTS "W-148 deny browser cvs delete" ON storage.objects;

CREATE POLICY "W-148 deny browser cvs select"
ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (bucket_id <> 'cvs');
CREATE POLICY "W-148 deny browser cvs insert"
ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (bucket_id <> 'cvs');
CREATE POLICY "W-148 deny browser cvs update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO public
USING (bucket_id <> 'cvs') WITH CHECK (bucket_id <> 'cvs');
CREATE POLICY "W-148 deny browser cvs delete"
ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (bucket_id <> 'cvs');
DROP POLICY IF EXISTS "Authenticated users can view opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update opportunity documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete opportunity documents" ON storage.objects;
