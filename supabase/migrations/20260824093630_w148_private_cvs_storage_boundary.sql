-- W-148: CVs and Lettres de cadrage are private records. Browser-facing
-- Storage access is not an authorization boundary for this bucket: the app
-- performs the role/ownership check and streams the authorised response.
--
-- The restrictive policies are deliberately retained after the legacy grants
-- are removed. PostgreSQL ANDs restrictive policies with every permissive
-- policy, so a future broad browser policy cannot re-open the `cvs` bucket.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'cvs') THEN
    RAISE EXCEPTION 'W-148 requires the existing cvs storage bucket';
  END IF;
END
$$;

UPDATE storage.buckets
SET public = false
WHERE id = 'cvs';

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Historical policy names observed on the live project and earlier checked-in
-- setup scripts. Each is scoped to `cvs`; no avatar or document-bucket policy
-- is changed here.
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
ON storage.objects
AS RESTRICTIVE
FOR SELECT
TO public
USING (bucket_id <> 'cvs');

CREATE POLICY "W-148 deny browser cvs insert"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (bucket_id <> 'cvs');

CREATE POLICY "W-148 deny browser cvs update"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO public
USING (bucket_id <> 'cvs')
WITH CHECK (bucket_id <> 'cvs');

CREATE POLICY "W-148 deny browser cvs delete"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO public
USING (bucket_id <> 'cvs');

COMMENT ON POLICY "W-148 deny browser cvs select" ON storage.objects IS
  'W-148: CV/LDC reads are server-authorized and server-streamed; browser Storage reads are denied.';
COMMENT ON POLICY "W-148 deny browser cvs insert" ON storage.objects IS
  'W-148: public intake uploads reach Storage only through the server-side token and validation boundary.';
COMMENT ON POLICY "W-148 deny browser cvs update" ON storage.objects IS
  'W-148: browser overwrite/upsert is denied for CV/LDC objects.';
COMMENT ON POLICY "W-148 deny browser cvs delete" ON storage.objects IS
  'W-148: browser deletion is denied for CV/LDC objects.';
