-- W-108: private, server-mediated attachments for the separate External Pursuit
-- domain. This migration intentionally has no opportunity, M&A, match, Gate,
-- export, import or browser-storage-policy dependency.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'external-pursuit-attachments',
  'external-pursuit-attachments',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep the released audit enum stable. Attachment activity is immutable
-- `updated` evidence with an explicit metadata kind; this avoids an unsafe
-- enum-value use in the same transactional migration.

CREATE TABLE IF NOT EXISTS public.external_pursuit_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_pursuit_id UUID NOT NULL REFERENCES public.external_pursuits(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  )),
  byte_size BIGINT NOT NULL CHECK (byte_size > 0 AND byte_size <= 20971520),
  created_by TEXT NOT NULL CHECK (NULLIF(BTRIM(created_by), '') IS NOT NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.external_pursuit_attachments
  DROP CONSTRAINT IF EXISTS external_pursuit_attachments_storage_path_check;
ALTER TABLE public.external_pursuit_attachments
  DROP CONSTRAINT IF EXISTS external_pursuit_attachment_path_matches_dossier;
ALTER TABLE public.external_pursuit_attachments
  ADD CONSTRAINT external_pursuit_attachment_path_matches_dossier CHECK (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
    AND split_part(storage_path, '/', 1)::UUID = external_pursuit_id
  );
CREATE INDEX IF NOT EXISTS external_pursuit_attachments_dossier_idx
  ON public.external_pursuit_attachments (external_pursuit_id, created_at ASC);

ALTER TABLE public.external_pursuit_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_pursuit_attachments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.external_pursuit_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.external_pursuit_attachments TO service_role;

-- Storage is never browser-addressable for this bucket: this migration creates
-- no `storage.objects` policy. The service-role client is used only after the
-- application action has performed its Better Auth access check. We do not
-- alter shared storage grants or policies used by existing document domains.

CREATE OR REPLACE FUNCTION public.external_pursuit_attachments_for_actor(
  p_dossier_id UUID,
  p_actor_user_id TEXT
) RETURNS TABLE (id UUID, original_filename TEXT, content_type TEXT, byte_size BIGINT, uploader_label TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  RETURN QUERY SELECT a.id, a.original_filename, a.content_type, a.byte_size,
    CASE
      WHEN a.created_by = NULLIF(BTRIM(p_actor_user_id), '') THEN 'You'::TEXT
      WHEN EXISTS (SELECT 1 FROM public.app_user_roles r WHERE r.user_id=a.created_by AND r.role='staff') THEN 'Re-New staff'::TEXT
      ELSE 'Dossier owner'::TEXT
    END,
    a.created_at
  FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id = p_dossier_id
  ORDER BY a.created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.external_pursuit_attachment_for_actor(
  p_dossier_id UUID,
  p_attachment_id UUID,
  p_actor_user_id TEXT
) RETURNS TABLE (storage_path TEXT, original_filename TEXT, content_type TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  RETURN QUERY SELECT a.storage_path, a.original_filename, a.content_type
  FROM public.external_pursuit_attachments a
  WHERE a.id = p_attachment_id AND a.external_pursuit_id = p_dossier_id;
END $$;

DROP FUNCTION IF EXISTS public.register_external_pursuit_attachment(UUID,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT);
CREATE FUNCTION public.register_external_pursuit_attachment(
  p_dossier_id UUID,
  p_storage_path TEXT,
  p_original_filename TEXT,
  p_content_type TEXT,
  p_byte_size BIGINT,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; attachment_id UUID; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  IF split_part(p_storage_path, '/', 1) <> p_dossier_id::TEXT THEN RAISE EXCEPTION 'External Pursuit attachment path is invalid.'; END IF;
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key) THEN
    SELECT (metadata->>'attachment_id')::UUID INTO attachment_id FROM public.external_pursuit_audit_events e
    WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_uploaded'
    LIMIT 1;
    IF attachment_id IS NOT NULL THEN RETURN (SELECT jsonb_build_object('attachment_id',a.id,'storage_path',a.storage_path) FROM public.external_pursuit_attachments a WHERE a.id=attachment_id); END IF;
    RAISE EXCEPTION 'External Pursuit attachment idempotency conflict.';
  END IF;
  INSERT INTO public.external_pursuit_attachments (external_pursuit_id,storage_path,original_filename,content_type,byte_size,created_by)
  VALUES (p_dossier_id,p_storage_path,BTRIM(p_original_filename),p_content_type,p_byte_size,actor)
  RETURNING id INTO attachment_id;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key,jsonb_build_object('kind','attachment_uploaded','attachment_id',attachment_id));
  RETURN jsonb_build_object('attachment_id',attachment_id,'storage_path',p_storage_path);
END $$;

DROP FUNCTION IF EXISTS public.external_pursuit_attachment_upload_replay(UUID,TEXT,TEXT);
CREATE FUNCTION public.external_pursuit_attachment_upload_replay(
  p_dossier_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE attachment_id UUID;
BEGIN
  PERFORM public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, FALSE);
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT (e.metadata->>'attachment_id')::UUID INTO attachment_id
  FROM public.external_pursuit_audit_events e
  WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=NULLIF(BTRIM(p_actor_user_id),'')
    AND e.idempotency_key=p_idempotency_key AND e.event_type='updated'
    AND e.metadata->>'kind'='attachment_uploaded'
  LIMIT 1;
  IF attachment_id IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT jsonb_build_object('attachment_id',a.id,'storage_path',a.storage_path) FROM public.external_pursuit_attachments a WHERE a.id=attachment_id);
END $$;

CREATE OR REPLACE FUNCTION public.delete_external_pursuit_attachment_record(
  p_dossier_id UUID,
  p_attachment_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; deleted_path TEXT; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'An idempotency key is required.'; END IF;
  SELECT storage_path INTO deleted_path FROM public.external_pursuit_attachments WHERE id=p_attachment_id AND external_pursuit_id=p_dossier_id;
  IF deleted_path IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_deleted') THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'External Pursuit attachment not found.';
  END IF;
  -- The application must delete this object before it calls this final metadata step.
  RETURN deleted_path;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_external_pursuit_attachment_deletion(
  p_dossier_id UUID,
  p_attachment_id UUID,
  p_actor_user_id TEXT,
  p_idempotency_key TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE; actor TEXT := NULLIF(BTRIM(p_actor_user_id), '');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_dossier_id::text, 0));
  p := public.assert_external_pursuit_access(p_dossier_id, actor, FALSE);
  IF EXISTS (SELECT 1 FROM public.external_pursuit_audit_events e WHERE e.external_pursuit_id=p_dossier_id AND e.actor_user_id=actor AND e.idempotency_key=p_idempotency_key AND e.event_type='updated' AND e.metadata->>'kind'='attachment_deleted') THEN RETURN; END IF;
  IF p.deletion_status <> 'active' THEN RAISE EXCEPTION 'External Pursuit is not editable.'; END IF;
  DELETE FROM public.external_pursuit_attachments WHERE id=p_attachment_id AND external_pursuit_id=p_dossier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'External Pursuit attachment not found.'; END IF;
  PERFORM public.external_pursuit_append_audit(p_dossier_id,'updated',actor,p_idempotency_key,jsonb_build_object('kind','attachment_deleted','attachment_id',p_attachment_id));
END $$;

CREATE OR REPLACE FUNCTION public.external_pursuit_attachment_cleanup_for_fulfillment(
  p_dossier_id UUID,
  p_actor_user_id TEXT
) RETURNS TABLE (id UUID, storage_path TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE;
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  RETURN QUERY SELECT a.id, a.storage_path FROM public.external_pursuit_attachments a
  WHERE a.external_pursuit_id=p_dossier_id ORDER BY a.created_at ASC;
END $$;

CREATE OR REPLACE FUNCTION public.clear_external_pursuit_attachment_records_for_fulfillment(
  p_dossier_id UUID,
  p_actor_user_id TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.external_pursuits%ROWTYPE;
BEGIN
  p := public.assert_external_pursuit_access(p_dossier_id, p_actor_user_id, TRUE);
  IF p.deletion_status <> 'delete_requested' THEN RAISE EXCEPTION 'External Pursuit deletion was not requested.'; END IF;
  DELETE FROM public.external_pursuit_attachments WHERE external_pursuit_id=p_dossier_id;
END $$;

REVOKE ALL ON FUNCTION
  public.external_pursuit_attachments_for_actor(UUID,TEXT),
  public.external_pursuit_attachment_for_actor(UUID,UUID,TEXT),
  public.external_pursuit_attachment_upload_replay(UUID,TEXT,TEXT),
  public.register_external_pursuit_attachment(UUID,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT),
  public.delete_external_pursuit_attachment_record(UUID,UUID,TEXT,TEXT),
  public.finalize_external_pursuit_attachment_deletion(UUID,UUID,TEXT,TEXT),
  public.external_pursuit_attachment_cleanup_for_fulfillment(UUID,TEXT),
  public.clear_external_pursuit_attachment_records_for_fulfillment(UUID,TEXT)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.external_pursuit_attachments_for_actor(UUID,TEXT),
  public.external_pursuit_attachment_for_actor(UUID,UUID,TEXT),
  public.external_pursuit_attachment_upload_replay(UUID,TEXT,TEXT),
  public.register_external_pursuit_attachment(UUID,TEXT,TEXT,TEXT,BIGINT,TEXT,TEXT),
  public.delete_external_pursuit_attachment_record(UUID,UUID,TEXT,TEXT),
  public.finalize_external_pursuit_attachment_deletion(UUID,UUID,TEXT,TEXT),
  public.external_pursuit_attachment_cleanup_for_fulfillment(UUID,TEXT),
  public.clear_external_pursuit_attachment_records_for_fulfillment(UUID,TEXT)
TO service_role;

COMMENT ON TABLE public.external_pursuit_attachments IS 'W-108 private External Pursuit attachments. Never an opportunity document, Gate, NDA, IM, source evidence, export or analytics input.';
