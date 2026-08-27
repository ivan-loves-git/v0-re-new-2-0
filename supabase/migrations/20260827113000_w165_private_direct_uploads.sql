-- W-165: private direct-to-Storage uploads with server-authorized intent and
-- server-verified atomic metadata finalization. No browser Storage policy is
-- introduced; signed upload capabilities are exact-path and upsert=false.

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg','image/png','image/webp','image/gif'
    ]::TEXT[]
WHERE id = 'opportunity-documents';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::TEXT[]
WHERE id = 'cvs';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 20971520
WHERE id = 'external-pursuit-attachments';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='opportunity-documents' AND NOT public AND file_size_limit=20971520)
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='cvs' AND NOT public AND file_size_limit=20971520)
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='external-pursuit-attachments' AND NOT public AND file_size_limit=20971520)
  THEN RAISE EXCEPTION 'w165_private_bucket_precondition_failed'; END IF;
END $$;

CREATE TABLE public.private_upload_intents (
  id UUID PRIMARY KEY,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('staff','portal','intake')),
  actor_key TEXT NOT NULL CHECK (NULLIF(BTRIM(actor_key),'') IS NOT NULL),
  actor_user_id TEXT,
  actor_repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  actor_email TEXT,
  actor_fingerprint TEXT,
  upload_kind TEXT NOT NULL CHECK (upload_kind IN (
    'opportunity_document','staff_nda_artifact','portal_signed_nda',
    'repreneur_document','external_pursuit_attachment'
  )),
  resource_id UUID,
  related_id UUID,
  bucket_id TEXT NOT NULL CHECK (bucket_id IN (
    'opportunity-documents','cvs','external-pursuit-attachments'
  )),
  storage_path TEXT NOT NULL UNIQUE CHECK (
    NULLIF(BTRIM(storage_path),'') IS NOT NULL
    AND storage_path !~ '(^|/)\.\.?(/|$)'
  ),
  original_filename TEXT NOT NULL CHECK (CHAR_LENGTH(original_filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (NULLIF(BTRIM(content_type),'') IS NOT NULL),
  declared_size BIGINT NOT NULL CHECK (declared_size BETWEEN 1 AND 20971520),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (JSONB_TYPEOF(metadata)='object'),
  idempotency_key UUID NOT NULL,
  finalize_secret_hash TEXT NOT NULL CHECK (finalize_secret_hash ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','finalized','rejected','expired')),
  content_sha256 TEXT CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  result JSONB CHECK (result IS NULL OR JSONB_TYPEOF(result)='object'),
  failure_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at),
  CHECK (
    (status='pending' AND finalized_at IS NULL AND content_sha256 IS NULL AND result IS NULL)
    OR (status='finalized' AND finalized_at IS NOT NULL AND content_sha256 IS NOT NULL AND result IS NOT NULL)
    OR (status IN ('rejected','expired') AND finalized_at IS NULL AND result IS NULL)
  )
);

CREATE INDEX private_upload_intents_cleanup_idx
  ON public.private_upload_intents(status,expires_at)
  WHERE status='pending';
CREATE INDEX private_upload_intents_actor_idx
  ON public.private_upload_intents(actor_key,created_at DESC);
CREATE UNIQUE INDEX private_upload_intents_idempotency_idx
  ON public.private_upload_intents(actor_key,upload_kind,idempotency_key);

-- Every object that must be removed is first recorded durably. Storage and
-- PostgreSQL cannot share one transaction, so the server attempts cleanup
-- immediately and the cron retries the same exact private path until proven.
CREATE TABLE public.private_upload_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.private_upload_intents(id) ON DELETE RESTRICT,
  bucket_id TEXT NOT NULL CHECK (bucket_id IN (
    'opportunity-documents','cvs','external-pursuit-attachments'
  )),
  storage_path TEXT NOT NULL CHECK (
    NULLIF(BTRIM(storage_path),'') IS NOT NULL
    AND storage_path !~ '(^|/)\.\.?(/|$)'
  ),
  reason TEXT NOT NULL CHECK (NULLIF(BTRIM(reason),'') IS NOT NULL),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(bucket_id,storage_path)
);
CREATE INDEX private_upload_cleanup_queue_pending_idx
  ON public.private_upload_cleanup_queue(created_at,id)
  WHERE completed_at IS NULL;

-- Public intake uploads are finalized as private, unclaimed records. The
-- opaque handle returned to the same browser can later claim the exact CV/LDC
-- for the newly-created repreneur. Unsubmitted forms expire and enter the
-- durable cleanup queue.
CREATE TABLE public.private_intake_upload_claims (
  intent_id UUID PRIMARY KEY REFERENCES public.private_upload_intents(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('cv','ldc')),
  claim_secret_hash TEXT NOT NULL CHECK (claim_secret_hash ~ '^[0-9a-f]{64}$'),
  claim_expires_at TIMESTAMPTZ NOT NULL,
  claimed_repreneur_id UUID REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  claimed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (claim_expires_at > created_at),
  CHECK (
    (claimed_repreneur_id IS NULL AND claimed_at IS NULL)
    OR (claimed_repreneur_id IS NOT NULL AND claimed_at IS NOT NULL)
  ),
  CHECK (NOT (claimed_at IS NOT NULL AND expired_at IS NOT NULL))
);
CREATE INDEX private_intake_upload_claims_expiry_idx
  ON public.private_intake_upload_claims(claim_expires_at,intent_id)
  WHERE claimed_at IS NULL AND expired_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_w165_private_upload_intent_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='finalized' THEN RAISE EXCEPTION 'w165_finalized_intent_is_immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status<>'pending' THEN RAISE EXCEPTION 'w165_closed_intent_is_immutable'; END IF;
  IF (NEW.id,NEW.actor_kind,NEW.actor_key,NEW.actor_user_id,NEW.actor_repreneur_id,
      NEW.actor_email,NEW.actor_fingerprint,NEW.upload_kind,NEW.resource_id,
      NEW.related_id,NEW.bucket_id,NEW.storage_path,NEW.original_filename,
      NEW.content_type,NEW.declared_size,NEW.metadata,NEW.idempotency_key,
      NEW.finalize_secret_hash,NEW.expires_at,NEW.created_at)
     IS DISTINCT FROM
     (OLD.id,OLD.actor_kind,OLD.actor_key,OLD.actor_user_id,OLD.actor_repreneur_id,
      OLD.actor_email,OLD.actor_fingerprint,OLD.upload_kind,OLD.resource_id,
      OLD.related_id,OLD.bucket_id,OLD.storage_path,OLD.original_filename,
      OLD.content_type,OLD.declared_size,OLD.metadata,OLD.idempotency_key,
      OLD.finalize_secret_hash,OLD.expires_at,OLD.created_at)
  THEN RAISE EXCEPTION 'w165_intent_authority_is_immutable'; END IF;
  IF NEW.status NOT IN ('pending','finalized','rejected','expired') THEN
    RAISE EXCEPTION 'w165_intent_transition_invalid';
  END IF;
  NEW.updated_at:=clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_w165_private_upload_intent_mutation
  BEFORE UPDATE OR DELETE ON public.private_upload_intents
  FOR EACH ROW EXECUTE FUNCTION public.guard_w165_private_upload_intent_mutation();

CREATE OR REPLACE FUNCTION public.close_w165_private_upload_intent(
  p_intent_id UUID,
  p_actor_key TEXT,
  p_status TEXT,
  p_failure_code TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.private_upload_intents%ROWTYPE; v_cleanup UUID;
BEGIN
  IF p_status NOT IN ('rejected','expired') OR NULLIF(BTRIM(p_failure_code),'') IS NULL
  THEN RAISE EXCEPTION 'w165_close_state_invalid'; END IF;
  SELECT * INTO v FROM public.private_upload_intents WHERE id=p_intent_id FOR UPDATE;
  IF NOT FOUND OR v.actor_key IS DISTINCT FROM p_actor_key THEN RAISE EXCEPTION 'w165_close_authority_denied'; END IF;
  IF v.status IN ('rejected','expired') THEN
    SELECT id INTO v_cleanup FROM public.private_upload_cleanup_queue
    WHERE bucket_id=v.bucket_id AND storage_path=v.storage_path;
    RETURN v_cleanup;
  END IF;
  IF v.status<>'pending' THEN RAISE EXCEPTION 'w165_finalized_intent_cannot_close'; END IF;
  INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
  VALUES(v.id,v.bucket_id,v.storage_path,p_failure_code)
  ON CONFLICT(bucket_id,storage_path) DO UPDATE
    SET updated_at=clock_timestamp()
  RETURNING id INTO v_cleanup;
  UPDATE public.private_upload_intents
  SET status=p_status,failure_code=p_failure_code
  WHERE id=v.id;
  RETURN v_cleanup;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_w165_intake_uploads(
  p_repreneur_id UUID,
  p_cv_intent_id UUID,
  p_cv_secret_hash TEXT,
  p_ldc_intent_id UUID DEFAULT NULL,
  p_ldc_secret_hash TEXT DEFAULT NULL
)
RETURNS TABLE(cv_path TEXT,ldc_path TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cv public.private_upload_intents%ROWTYPE; v_ldc public.private_upload_intents%ROWTYPE;
BEGIN
  IF (p_cv_intent_id IS NULL) <> (p_cv_secret_hash IS NULL)
    OR (p_ldc_intent_id IS NULL) <> (p_ldc_secret_hash IS NULL)
    OR (p_cv_intent_id IS NULL AND p_ldc_intent_id IS NULL)
    OR (p_cv_secret_hash IS NOT NULL AND p_cv_secret_hash !~ '^[0-9a-f]{64}$')
    OR (p_ldc_secret_hash IS NOT NULL AND p_ldc_secret_hash !~ '^[0-9a-f]{64}$')
  THEN RAISE EXCEPTION 'w165_intake_claim_invalid'; END IF;
  PERFORM 1 FROM public.repreneurs WHERE id=p_repreneur_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'w165_intake_repreneur_not_found'; END IF;

  IF p_cv_intent_id IS NOT NULL THEN
    SELECT intent.* INTO v_cv
    FROM public.private_upload_intents intent
    JOIN public.private_intake_upload_claims claim ON claim.intent_id=intent.id
    WHERE intent.id=p_cv_intent_id AND intent.status='finalized'
      AND intent.actor_kind='intake' AND intent.upload_kind='repreneur_document'
      AND intent.metadata->>'document_type'='cv'
      AND claim.document_type='cv' AND claim.claim_secret_hash=p_cv_secret_hash
      AND claim.claimed_at IS NULL AND claim.expired_at IS NULL
      AND claim.claim_expires_at>clock_timestamp()
    FOR UPDATE OF intent;
    IF NOT FOUND THEN RAISE EXCEPTION 'w165_intake_cv_claim_denied'; END IF;
  END IF;

  IF p_ldc_intent_id IS NOT NULL THEN
    SELECT intent.* INTO v_ldc
    FROM public.private_upload_intents intent
    JOIN public.private_intake_upload_claims claim ON claim.intent_id=intent.id
    WHERE intent.id=p_ldc_intent_id AND intent.status='finalized'
      AND intent.actor_kind='intake' AND intent.upload_kind='repreneur_document'
      AND intent.metadata->>'document_type'='ldc'
      AND claim.document_type='ldc' AND claim.claim_secret_hash=p_ldc_secret_hash
      AND claim.claimed_at IS NULL AND claim.expired_at IS NULL
      AND claim.claim_expires_at>clock_timestamp()
    FOR UPDATE OF intent;
    IF NOT FOUND THEN RAISE EXCEPTION 'w165_intake_ldc_claim_denied'; END IF;
  END IF;

  UPDATE public.private_intake_upload_claims
  SET claimed_repreneur_id=p_repreneur_id,claimed_at=clock_timestamp()
  WHERE intent_id IN (p_cv_intent_id,p_ldc_intent_id);
  UPDATE public.repreneurs
  SET cv_url=CASE WHEN p_cv_intent_id IS NULL THEN cv_url ELSE v_cv.storage_path END,
      ldc_url=CASE WHEN p_ldc_intent_id IS NULL THEN ldc_url ELSE v_ldc.storage_path END
  WHERE id=p_repreneur_id;
  RETURN QUERY SELECT CASE WHEN p_cv_intent_id IS NULL THEN NULL::TEXT ELSE v_cv.storage_path END,
    CASE WHEN p_ldc_intent_id IS NULL THEN NULL::TEXT ELSE v_ldc.storage_path END;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_w165_intake_upload_claim(
  p_intent_id UUID,
  p_actor_key TEXT,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.private_upload_intents%ROWTYPE; v_claim public.private_intake_upload_claims%ROWTYPE; v_cleanup UUID;
BEGIN
  SELECT * INTO v FROM public.private_upload_intents WHERE id=p_intent_id FOR UPDATE;
  SELECT * INTO v_claim FROM public.private_intake_upload_claims WHERE intent_id=p_intent_id FOR UPDATE;
  IF v.id IS NULL OR v_claim.intent_id IS NULL OR v.actor_key IS DISTINCT FROM p_actor_key
  THEN RAISE EXCEPTION 'w165_intake_expiry_authority_denied'; END IF;
  IF v_claim.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'w165_claimed_intake_upload_is_retained'; END IF;
  IF v_claim.expired_at IS NOT NULL THEN
    SELECT id INTO v_cleanup FROM public.private_upload_cleanup_queue
    WHERE bucket_id=v.bucket_id AND storage_path=v.storage_path;
    RETURN v_cleanup;
  END IF;
  IF NOT p_force AND v_claim.claim_expires_at>clock_timestamp() THEN
    RAISE EXCEPTION 'w165_intake_claim_not_expired';
  END IF;
  INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
  VALUES(v.id,v.bucket_id,v.storage_path,CASE WHEN p_force THEN 'intake_abandoned' ELSE 'intake_claim_expired' END)
  ON CONFLICT(bucket_id,storage_path) DO UPDATE SET updated_at=clock_timestamp()
  RETURNING id INTO v_cleanup;
  UPDATE public.private_intake_upload_claims SET expired_at=clock_timestamp() WHERE intent_id=v.id;
  RETURN v_cleanup;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_w165_private_upload(
  p_intent_id UUID,
  p_actor_key TEXT,
  p_finalize_secret_hash TEXT,
  p_content_sha256 TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v public.private_upload_intents%ROWTYPE;
  v_result JSONB;
  v_document_id UUID;
  v_nda RECORD;
  v_portal_nda RECORD;
  v_external JSONB;
  v_previous_path TEXT;
  v_document_type TEXT;
  v_visibility public.opportunity_document_visibility;
BEGIN
  IF p_content_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'w165_digest_invalid'; END IF;
  SELECT * INTO v FROM public.private_upload_intents WHERE id=p_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'w165_intent_not_found'; END IF;
  IF v.actor_key IS DISTINCT FROM p_actor_key
    OR v.finalize_secret_hash IS DISTINCT FROM p_finalize_secret_hash
  THEN RAISE EXCEPTION 'w165_finalize_authority_denied'; END IF;
  IF v.status='finalized' THEN
    IF v.content_sha256 IS DISTINCT FROM LOWER(p_content_sha256) THEN
      RAISE EXCEPTION 'w165_finalize_digest_conflict';
    END IF;
    RETURN v.result;
  END IF;
  IF v.status<>'pending' THEN RAISE EXCEPTION 'w165_intent_closed'; END IF;
  IF v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'w165_intent_expired'; END IF;

  IF v.upload_kind='opportunity_document' THEN
    IF v.actor_kind<>'staff' OR v.resource_id IS NULL THEN RAISE EXCEPTION 'w165_opportunity_document_authority_denied'; END IF;
    v_document_type:=v.metadata->>'document_type';
    v_visibility:=COALESCE(v.metadata->>'visibility','staff_only')::public.opportunity_document_visibility;
    INSERT INTO public.opportunity_documents(
      opportunity_id,title,document_type,visibility,storage_bucket,storage_path,
      file_name,mime_type,size_bytes,uploaded_by,repreneur_approved_at,repreneur_approved_by
    ) VALUES(
      v.resource_id,NULLIF(BTRIM(v.metadata->>'title'),''),v_document_type::public.opportunity_document_type,
      v_visibility,v.bucket_id,v.storage_path,v.original_filename,v.content_type,
      v.declared_size,v.actor_user_id,
      CASE WHEN v_visibility='approved_for_repreneur' THEN clock_timestamp() ELSE NULL END,
      CASE WHEN v_visibility='approved_for_repreneur' THEN v.actor_user_id ELSE NULL END
    ) RETURNING id INTO v_document_id;
    v_result:=JSONB_BUILD_OBJECT('documentId',v_document_id,'message','Document added.');

  ELSIF v.upload_kind='staff_nda_artifact' THEN
    IF v.actor_kind<>'staff' OR v.resource_id IS NULL OR NULLIF(BTRIM(v.actor_email),'') IS NULL
    THEN RAISE EXCEPTION 'w165_staff_nda_authority_denied'; END IF;
    SELECT * INTO v_nda FROM public.register_opportunity_nda_artifact(
      v.resource_id,v.related_id,v.metadata->>'artifact_role',v.metadata->>'title',
      v.storage_path,v.original_filename,v.declared_size,LOWER(p_content_sha256),v.actor_email
    );
    v_result:=JSONB_BUILD_OBJECT(
      'artifactId',v_nda.artifact_id,'documentId',v_nda.document_id,
      'versionNumber',v_nda.version_number,'message','NDA artifact recorded.'
    );

  ELSIF v.upload_kind='portal_signed_nda' THEN
    IF v.actor_kind<>'portal' OR v.resource_id IS NULL OR v.related_id IS NULL
      OR v.actor_repreneur_id IS DISTINCT FROM v.related_id
      OR NULLIF(BTRIM(v.actor_email),'') IS NULL
    THEN RAISE EXCEPTION 'w165_portal_nda_authority_denied'; END IF;
    SELECT * INTO v_portal_nda FROM public.journey_submit_repreneur_signed_copy_v2(
      v.resource_id,v.related_id,v.actor_email,COALESCE(NULLIF(BTRIM(v.metadata->>'title'),''),'NDA signed by repreneur'),
      v.storage_path,v.original_filename,v.declared_size,LOWER(p_content_sha256)
    );
    v_result:=JSONB_BUILD_OBJECT(
      'artifactId',v_portal_nda.artifact_id,'documentId',v_portal_nda.document_id,
      'versionNumber',v_portal_nda.version_number,'reusedExisting',v_portal_nda.reused_existing,
      'message','Your signed NDA has been received for staff validation.'
    );

  ELSIF v.upload_kind='repreneur_document' THEN
    v_document_type:=v.metadata->>'document_type';
    IF v_document_type NOT IN ('cv','ldc') THEN RAISE EXCEPTION 'w165_repreneur_document_type_invalid'; END IF;
    IF v.actor_kind='intake' THEN
      IF v.resource_id IS NOT NULL THEN RAISE EXCEPTION 'w165_intake_resource_invalid'; END IF;
      INSERT INTO public.private_intake_upload_claims(
        intent_id,document_type,claim_secret_hash,claim_expires_at
      ) VALUES(
        v.id,v_document_type,v.finalize_secret_hash,clock_timestamp()+INTERVAL '24 hours'
      );
      v_result:=JSONB_BUILD_OBJECT('documentType',v_document_type,'message','Document uploaded.');
    ELSE
      IF v.resource_id IS NULL OR (v.actor_kind='portal' AND v.actor_repreneur_id IS DISTINCT FROM v.resource_id)
      THEN RAISE EXCEPTION 'w165_repreneur_document_authority_denied'; END IF;
      IF v_document_type='cv' THEN
        SELECT cv_url INTO v_previous_path FROM public.repreneurs WHERE id=v.resource_id FOR UPDATE;
        UPDATE public.repreneurs SET cv_url=v.storage_path WHERE id=v.resource_id;
      ELSE
        SELECT ldc_url INTO v_previous_path FROM public.repreneurs WHERE id=v.resource_id FOR UPDATE;
        IF v.actor_kind='portal' AND EXISTS(
          SELECT 1 FROM public.repreneurs WHERE id=v.resource_id AND ms_ldc_validated
        ) THEN RAISE EXCEPTION 'w165_validated_ldc_replacement_denied'; END IF;
        UPDATE public.repreneurs
        SET ldc_url=v.storage_path,
            ldc_self_certified_at=CASE WHEN v.actor_kind='portal' THEN clock_timestamp() ELSE ldc_self_certified_at END
        WHERE id=v.resource_id;
      END IF;
      IF NOT FOUND THEN RAISE EXCEPTION 'w165_repreneur_not_found'; END IF;
      v_result:=JSONB_BUILD_OBJECT(
        'path',v.storage_path,'url','/api/repreneurs/'||v.resource_id::TEXT||'/documents/'||v_document_type,
        'documentType',v_document_type,'previousStoragePath',v_previous_path,'message','Document uploaded.'
      );
    END IF;

  ELSIF v.upload_kind='external_pursuit_attachment' THEN
    IF v.actor_kind NOT IN ('staff','portal') OR v.resource_id IS NULL OR NULLIF(BTRIM(v.actor_user_id),'') IS NULL
    THEN RAISE EXCEPTION 'w165_external_attachment_authority_denied'; END IF;
    v_external:=public.register_external_pursuit_attachment(
      v.resource_id,v.storage_path,v.original_filename,v.content_type,v.declared_size,
      v.actor_user_id,v.idempotency_key::TEXT
    );
    v_result:=JSONB_BUILD_OBJECT(
      'attachmentId',v_external->>'attachment_id','storagePath',v_external->>'storage_path',
      'reusedExisting',(v_external->>'storage_path') IS DISTINCT FROM v.storage_path,
      'message','Attachment added.'
    );
  ELSE
    RAISE EXCEPTION 'w165_upload_kind_invalid';
  END IF;

  IF v.upload_kind='portal_signed_nda' AND COALESCE((v_result->>'reusedExisting')::BOOLEAN,FALSE) THEN
    INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
    VALUES(v.id,v.bucket_id,v.storage_path,'duplicate_portal_nda')
    ON CONFLICT(bucket_id,storage_path) DO NOTHING;
  ELSIF v.upload_kind='repreneur_document'
    AND v.actor_kind<>'intake'
    AND NULLIF(v_result->>'previousStoragePath','') IS NOT NULL
    AND (v_result->>'previousStoragePath') LIKE 'cvs/%'
    AND (v_result->>'previousStoragePath') !~ '(^|/)\.\.?(/|$)'
    AND (v_result->>'previousStoragePath') IS DISTINCT FROM v.storage_path
  THEN
    INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
    VALUES(v.id,'cvs',v_result->>'previousStoragePath','replaced_repreneur_document')
    ON CONFLICT(bucket_id,storage_path) DO NOTHING;
  ELSIF v.upload_kind='external_pursuit_attachment'
    AND COALESCE((v_result->>'reusedExisting')::BOOLEAN,FALSE)
  THEN
    INSERT INTO public.private_upload_cleanup_queue(intent_id,bucket_id,storage_path,reason)
    VALUES(v.id,v.bucket_id,v.storage_path,'duplicate_external_attachment')
    ON CONFLICT(bucket_id,storage_path) DO NOTHING;
  END IF;

  UPDATE public.private_upload_intents
  SET status='finalized',content_sha256=LOWER(p_content_sha256),result=v_result,
      finalized_at=clock_timestamp(),failure_code=NULL
  WHERE id=v.id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON TABLE public.private_upload_intents,
  public.private_upload_cleanup_queue,public.private_intake_upload_claims
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.private_upload_intents TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.private_upload_cleanup_queue,
  public.private_intake_upload_claims TO service_role;
REVOKE ALL ON FUNCTION public.guard_w165_private_upload_intent_mutation(),
  public.close_w165_private_upload_intent(UUID,TEXT,TEXT,TEXT),
  public.claim_w165_intake_uploads(UUID,UUID,TEXT,UUID,TEXT),
  public.expire_w165_intake_upload_claim(UUID,TEXT,BOOLEAN),
  public.finalize_w165_private_upload(UUID,TEXT,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.guard_w165_private_upload_intent_mutation(),
  public.close_w165_private_upload_intent(UUID,TEXT,TEXT,TEXT),
  public.claim_w165_intake_uploads(UUID,UUID,TEXT,UUID,TEXT),
  public.expire_w165_intake_upload_claim(UUID,TEXT,BOOLEAN),
  public.finalize_w165_private_upload(UUID,TEXT,TEXT,TEXT)
  TO service_role;

COMMENT ON TABLE public.private_upload_intents IS
  'W-165 exact-path upload capabilities. Bytes are private and untrusted until server validation and atomic finalization.';
