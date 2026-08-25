-- W-148: CVs and Lettres de cadrage are private records. Browser-facing
-- Storage access is not an authorization boundary for this bucket: the app
-- performs the role/ownership check and streams the authorised response.
--
-- The restrictive policies are deliberately retained after the legacy grants
-- are removed. PostgreSQL ANDs restrictive policies with every permissive
-- policy, so a future broad browser policy cannot re-open the `cvs` bucket.
--
-- Hosted Supabase owns storage.objects as supabase_storage_admin. RLS is
-- already enabled and the bucket is already private, so this migration only
-- manages the supported custom policy surface.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'cvs'
      AND public = false
  ) THEN
    RAISE EXCEPTION 'W-148 requires the existing private cvs storage bucket';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage'
      AND c.relname = 'objects'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'W-148 requires RLS to be enabled on storage.objects';
  END IF;
END
$$;

-- Install the fail-closed guards before removing the historical grants. The
-- enclosing release transaction makes the policy swap externally atomic.
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
