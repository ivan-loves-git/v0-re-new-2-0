-- #42 final-retirement gate only: apply after all attachment imports and WAVE UAT.
-- This intentionally breaks the standalone PDR's publishable-key reads. Do not
-- apply it with the #43 foundation migration or before the documented cutover.
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (
    SELECT 'proposal'::text AS owner_kind, proposal.id AS owner_id, attachment
    FROM public.pdr_proposals proposal
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(proposal.attachments, '[]'::jsonb)) attachment
    UNION ALL
    SELECT 'work_card'::text AS owner_kind, card.id AS owner_id, attachment
    FROM public.pdr_work_cards card
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(card.attachments, '[]'::jsonb)) attachment
  ) legacy
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.wave_pdr_history_attachments private_attachment
    WHERE ((legacy.owner_kind = 'proposal' AND private_attachment.proposal_id = legacy.owner_id)
       OR (legacy.owner_kind = 'work_card' AND private_attachment.work_card_id = legacy.owner_id))
      AND private_attachment.legacy_source_fingerprint = encode(
        extensions.digest(convert_to(legacy.owner_kind || ':' || legacy.owner_id::text || ':' || (legacy.attachment->>'url'), 'UTF8'), 'sha256'),
        'hex'
      )
  );

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'pdr_legacy_attachments_not_fully_private:%', missing_count;
  END IF;
END $$;

-- Hosted Supabase owns storage.objects as supabase_storage_admin. A hosted
-- release must therefore pre-stage this exact custom policy through Supabase's
-- supported migration surface using scripts/prestage-pdr-storage-guard.sql.
-- Disposable databases owned by the migration role may create it here. Either
-- way, retirement fails closed unless the
-- provider-owned guard reads back exactly before browser grants are revoked.
DO $$
DECLARE
  objects_owner text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'storage'
      AND relation.relname = 'objects'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'pdr_legacy_storage_rls_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'wave_pdr_retire_legacy_attachment_browser_access'
  ) THEN
    SELECT pg_get_userbyid(relation.relowner)
    INTO objects_owner
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'storage'
      AND relation.relname = 'objects';

    IF objects_owner IS DISTINCT FROM current_user THEN
      RAISE EXCEPTION 'pdr_legacy_storage_guard_must_be_pre_staged';
    END IF;

    EXECUTE $policy$
      CREATE POLICY wave_pdr_retire_legacy_attachment_browser_access
      ON storage.objects
      AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (bucket_id <> 'pdr-attachments')
      WITH CHECK (bucket_id <> 'pdr-attachments')
    $policy$;
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
    RAISE EXCEPTION 'pdr_legacy_storage_guard_mismatch';
  END IF;
END $$;

REVOKE ALL ON TABLE public.pdr_feedback, public.pdr_goals, public.pdr_milestones, public.pdr_proposals, public.pdr_requests, public.pdr_work_cards FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pdr_feedback, public.pdr_goals, public.pdr_milestones, public.pdr_proposals, public.pdr_requests, public.pdr_work_cards TO service_role;
-- Direct SQL does not invoke the Storage service's public-to-private CDN purge.
-- Run pnpm pdr:purge-legacy-storage-cache after this transaction and require
-- pnpm pdr:verify-final-retirement to pass before accepting the retirement.
UPDATE storage.buckets SET public=FALSE WHERE id='pdr-attachments';
CREATE OR REPLACE FUNCTION public.wave_pdr_historical_work_cards_read_only() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'wave_pdr_historical_work_cards_are_read_only'; END; $$;
DROP TRIGGER IF EXISTS wave_pdr_historical_work_cards_read_only ON public.pdr_work_cards;
CREATE TRIGGER wave_pdr_historical_work_cards_read_only BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.pdr_work_cards FOR EACH STATEMENT EXECUTE FUNCTION public.wave_pdr_historical_work_cards_read_only();
