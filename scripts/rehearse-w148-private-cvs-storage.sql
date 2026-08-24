-- Disposable W-148 rehearsal. Run only against a local or QA-only database:
--   psql "$W148_REHEARSAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rehearse-w148-private-cvs-storage.sql
--
-- It creates one synthetic storage catalog row and rolls the entire transaction
-- back. It never reads object content and is not a production procedure.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Supabase and its production-shaped local fixtures already own these roles.
-- A raw PostgreSQL disposable fixture does not, so create them only there.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'cvs');
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'cvs');
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cvs');
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cvs');

\ir ../supabase/migrations/20260824093630_w148_private_cvs_storage_boundary.sql

DO $$
DECLARE
  expected_policy TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'cvs' AND public
  ) THEN
    RAISE EXCEPTION 'Expected cvs bucket to remain private';
  END IF;

  FOREACH expected_policy IN ARRAY ARRAY[
    'Allow public read access',
    'Allow public uploads',
    'Allow authenticated updates',
    'Allow authenticated deletes'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = expected_policy
    ) THEN
      RAISE EXCEPTION 'Legacy policy % remains', expected_policy;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname LIKE 'W-148 deny browser cvs %'
        AND permissive = 'RESTRICTIVE') <> 4 THEN
    RAISE EXCEPTION 'Expected four restrictive W-148 storage policies';
  END IF;
END
$$;

-- Synthetic catalog-only object: proves that an anon list/direct-read query
-- cannot see a CV/LDC object after the migration. No file bytes are created.
INSERT INTO storage.objects (bucket_id, name)
VALUES ('cvs', 'w148-rehearsal/synthetic-object');

SET LOCAL ROLE anon;

DO $$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count
  FROM storage.objects
  WHERE bucket_id = 'cvs';

  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'Anon SELECT/list must not expose cvs objects';
  END IF;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('cvs', 'w148-rehearsal/anon-upload-attempt');
    RAISE EXCEPTION 'Anon INSERT/upload must be denied';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;

RESET ROLE;
ROLLBACK;
