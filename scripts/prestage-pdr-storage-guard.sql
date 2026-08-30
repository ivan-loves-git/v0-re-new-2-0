-- Run this file through Supabase's provider-managed SQL migration surface
-- before 20260830113100_wave_pdr_final_retirement.sql. A normal application
-- database role does not own storage.objects on hosted Supabase.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'wave_pdr_retire_legacy_attachment_browser_access'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'wave_pdr_retire_legacy_attachment_browser_access'
      AND permissive = 'RESTRICTIVE'
      AND roles = ARRAY['anon', 'authenticated']::name[]
      AND cmd = 'ALL'
      AND qual = '(bucket_id <> ''pdr-attachments''::text)'
      AND with_check = '(bucket_id <> ''pdr-attachments''::text)'
  ) THEN
    RAISE EXCEPTION 'pdr_legacy_storage_guard_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'wave_pdr_retire_legacy_attachment_browser_access'
  ) THEN
    CREATE POLICY wave_pdr_retire_legacy_attachment_browser_access
    ON storage.objects
    AS RESTRICTIVE
    FOR ALL
    TO anon, authenticated
    USING (bucket_id <> 'pdr-attachments')
    WITH CHECK (bucket_id <> 'pdr-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'wave_pdr_retire_legacy_attachment_browser_access'
      AND permissive = 'RESTRICTIVE'
      AND roles = ARRAY['anon', 'authenticated']::name[]
      AND cmd = 'ALL'
      AND qual = '(bucket_id <> ''pdr-attachments''::text)'
      AND with_check = '(bucket_id <> ''pdr-attachments''::text)'
  ) THEN
    RAISE EXCEPTION 'pdr_legacy_storage_guard_verification_failed';
  END IF;
END $$;
