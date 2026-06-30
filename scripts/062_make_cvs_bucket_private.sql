-- Security hardening: CV/LDC documents contain sensitive personal and business data.
-- They must be served through app-controlled signed URLs, not public bucket URLs.

UPDATE storage.buckets
SET public = false
WHERE id = 'cvs';

DROP POLICY IF EXISTS "Anyone can view CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update CVs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete CVs" ON storage.objects;
