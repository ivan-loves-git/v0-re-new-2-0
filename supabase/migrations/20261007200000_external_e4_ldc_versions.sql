BEGIN;
-- #248 US-39–41 / AC-26–27: retain an exact version of the existing private LDC.
-- No historical receipt rewrite and no new self-certification/staff-validation gate.
-- The existing private cvs bucket already has the released W148 restrictive
-- browser CRUD/list boundary. No provider-owned Storage DDL is required here.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='cvs' AND NOT public AND file_size_limit=20971520)
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN ('W-148 deny browser cvs select','W-148 deny browser cvs insert','W-148 deny browser cvs update','W-148 deny browser cvs delete')
      AND permissive='RESTRICTIVE' AND roles=ARRAY['public']::name[]
      AND ((cmd='SELECT' AND qual='(bucket_id <> ''cvs''::text)' AND with_check IS NULL)
        OR (cmd='INSERT' AND qual IS NULL AND with_check='(bucket_id <> ''cvs''::text)')
        OR (cmd='UPDATE' AND qual='(bucket_id <> ''cvs''::text)' AND with_check='(bucket_id <> ''cvs''::text)')
        OR (cmd='DELETE' AND qual='(bucket_id <> ''cvs''::text)' AND with_check IS NULL)))<>4
  THEN RAISE EXCEPTION 'external_ldc_existing_storage_boundary_required'; END IF;
END $$;
-- Decode only printable ASCII escapes for this reserved-key predicate; never
-- rewrite a profile or turn unknown historical URLs into claimed ownership.
CREATE FUNCTION public.external_ldc_reserved_path(p_value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
DECLARE decoded text:=btrim(coalesce(p_value,'')); escaped text; ascii_code integer;
BEGIN
  FOR escaped IN SELECT DISTINCT match[1] FROM regexp_matches(decoded,'(%[0-9A-Fa-f]{2})','g') match LOOP
    ascii_code:=get_byte(decode(substring(escaped FROM 2),'hex'),0);
    IF ascii_code BETWEEN 32 AND 126 THEN decoded:=replace(decoded,escaped,chr(ascii_code)); END IF;
  END LOOP;
  RETURN decoded ~ '(^|/)pursuit-ldc-evidence(/|$)';
END $$;
REVOKE ALL ON FUNCTION public.external_ldc_reserved_path(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.external_ldc_reserved_path(text) TO anon,authenticated,service_role;
-- All three validated exclusions survive old app/disable/revert. A queued/read
-- original key is physically distinct, and old code cannot alias a retained
-- key into its profile-delete, W165 upload-finalize or cleanup-queue surfaces.
ALTER TABLE public.private_upload_cleanup_queue ADD CONSTRAINT private_upload_cleanup_no_retained_ldc
CHECK(bucket_id<>'cvs' OR NOT public.external_ldc_reserved_path(storage_path));
ALTER TABLE public.private_upload_intents ADD CONSTRAINT private_upload_intent_no_retained_ldc
CHECK(bucket_id<>'cvs' OR NOT public.external_ldc_reserved_path(storage_path));
ALTER TABLE public.repreneurs ADD CONSTRAINT repreneur_profile_no_retained_ldc_alias
CHECK(NOT public.external_ldc_reserved_path(cv_url) AND NOT public.external_ldc_reserved_path(ldc_url));

CREATE TABLE public.pursuit_ldc_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  is_demo boolean NOT NULL,
  source jsonb NOT NULL CHECK(jsonb_typeof(source)='object'),
  source_key text NOT NULL UNIQUE CHECK(source_key ~ '^[0-9a-f]{64}$'),
  storage_path text NOT NULL UNIQUE CHECK(storage_path ~ '^pursuit-ldc-evidence/[0-9a-f-]{36}/ldc/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  storage_object_id uuid NOT NULL,
  storage_object_version text NOT NULL,
  content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 20971520),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pursuit_external_ldc_receipts (
  receipt_id uuid PRIMARY KEY REFERENCES public.opportunity_pursuit_external_handoffs(id) ON DELETE RESTRICT,
  version_id uuid NOT NULL REFERENCES public.pursuit_ldc_versions(id) ON DELETE RESTRICT
);
CREATE TABLE public.pursuit_ldc_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key uuid NOT NULL UNIQUE,
  match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  staff_user_id text NOT NULL,
  staff_email text NOT NULL,
  context jsonb NOT NULL CHECK(jsonb_typeof(context)='object'),
  storage_path text NOT NULL CHECK(storage_path LIKE 'pursuit-ldc-evidence/'||(context->>'repreneur_id')||'/ldc/%' AND storage_path ~ '^pursuit-ldc-evidence/[0-9a-f-]{36}/ldc/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  version_id uuid REFERENCES public.pursuit_ldc_versions(id) ON DELETE RESTRICT,
  CHECK(version_id IS NOT NULL OR storage_path='pursuit-ldc-evidence/'||(context->>'repreneur_id')||'/ldc/'||operation_key::text||'/'||id::text||'.pdf'),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','retained','cleanup','cleaned')),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.pursuit_ldc_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_ldc_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_external_ldc_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_external_ldc_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_ldc_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_ldc_staging FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_ldc_versions,public.pursuit_external_ldc_receipts,public.pursuit_ldc_staging FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.pursuit_ldc_versions,public.pursuit_external_ldc_receipts,public.pursuit_ldc_staging TO service_role;
CREATE TRIGGER immutable_ldc_version BEFORE UPDATE OR DELETE ON public.pursuit_ldc_versions
FOR EACH ROW EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER immutable_ldc_version_truncate BEFORE TRUNCATE ON public.pursuit_ldc_versions
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER immutable_ldc_receipt BEFORE UPDATE OR DELETE ON public.pursuit_external_ldc_receipts
FOR EACH ROW EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER immutable_ldc_receipt_truncate BEFORE TRUNCATE ON public.pursuit_external_ldc_receipts
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_external_handoff_mutation();

CREATE FUNCTION public.journey_current_ldc_source(p_match_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage,pg_temp AS $$
DECLARE m public.opportunity_matches%ROWTYPE; r public.repreneurs%ROWTYPE;
  source_path text; object_row storage.objects%ROWTYPE; intent public.private_upload_intents%ROWTYPE; file_name text;
BEGIN
  SELECT * INTO m FROM public.opportunity_matches WHERE id=p_match_id;
  SELECT * INTO r FROM public.repreneurs WHERE id=m.repreneur_id;
  IF m.id IS NULL OR m.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunities o
    WHERE o.id=m.opportunity_id AND o.status='active' AND o.is_demo=r.is_demo)
  THEN RAISE EXCEPTION 'external_ldc_owner_or_namespace_invalid'; END IF;
  source_path:=btrim(r.ldc_url);
  IF source_path ~ '^https?://' THEN
    source_path:=substring(source_path FROM '^https?://[^/]+/storage/v1/object/(?:public|sign|authenticated)/cvs/([^?]+)');
  END IF;
  IF source_path IS NULL OR source_path='' OR length(source_path)>1024 OR source_path ~ '(^/|\\|%|(^|/)\.\.?(/|$))'
  THEN RAISE EXCEPTION 'external_ldc_source_missing'; END IF;
  SELECT * INTO object_row FROM storage.objects WHERE bucket_id='cvs' AND name=source_path;
  SELECT * INTO intent FROM public.private_upload_intents WHERE bucket_id='cvs' AND storage_path=source_path
;
  -- Canonical owner path or an actual finalized intake claim proves ownership.
  -- Unknown historical paths are not relabelled as an owner's version.
  IF (intent.id IS NOT NULL AND (intent.upload_kind<>'repreneur_document' OR intent.metadata->>'document_type' IS DISTINCT FROM 'ldc'
      OR intent.status<>'finalized' OR NOT (intent.resource_id=r.id OR EXISTS(SELECT 1 FROM public.private_intake_upload_claims claim
        WHERE claim.intent_id=intent.id AND claim.document_type='ldc' AND claim.claimed_repreneur_id=r.id AND claim.claimed_at IS NOT NULL))))
    OR (intent.id IS NULL AND NOT (source_path LIKE 'cvs/'||r.id::text||'/ldc/%' OR source_path ~ ('^cvs/'||r.id::text||'-ldc-[0-9]+\.pdf$')))
  THEN RAISE EXCEPTION 'external_ldc_source_owner_invalid'; END IF;
  file_name:=coalesce(intent.original_filename,split_part(source_path,'/',array_length(string_to_array(source_path,'/'),1)));
  IF object_row.id IS NULL OR nullif(object_row.version,'') IS NULL OR object_row.updated_at IS NULL
    OR object_row.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf' OR lower(file_name) NOT LIKE '%.pdf'
    OR coalesce(object_row.metadata->>'size','') !~ '^[0-9]+$'
    OR (object_row.metadata->>'size')::bigint NOT BETWEEN 1 AND 20971520
    OR (intent.id IS NOT NULL AND (intent.content_type<>'application/pdf' OR intent.declared_size<>(object_row.metadata->>'size')::bigint))
  THEN RAISE EXCEPTION 'external_ldc_pdf_version_invalid'; END IF;
  RETURN jsonb_build_object('source_object_id',object_row.id,'source_version',object_row.version,
    'source_updated_at',object_row.updated_at,'profile_source_sha256',encode(extensions.digest(r.ldc_url,'sha256'),'hex'),'source_path',source_path,'source_upload_id',intent.id,
    'file_name',file_name,'mime_type','application/pdf','size_bytes',(object_row.metadata->>'size')::bigint,
    'content_sha256',intent.content_sha256);
END $$;
REVOKE ALL ON FUNCTION public.journey_current_ldc_source(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_current_ldc_source(uuid) TO service_role;

ALTER FUNCTION public.journey_external_handoff_context(uuid,text) RENAME TO journey_external_handoff_context_before_ldc;
REVOKE ALL ON FUNCTION public.journey_external_handoff_context_before_ldc(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.journey_external_handoff_context(p_match_id uuid,p_handoff_type text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE context jsonb;
BEGIN
  context:=public.journey_external_handoff_context_before_ldc(p_match_id,p_handoff_type);
  IF p_handoff_type='e4' THEN context:=context||jsonb_build_object('ldc',public.journey_current_ldc_source(p_match_id)); END IF;
  RETURN context;
END $$;
REVOKE ALL ON FUNCTION public.journey_external_handoff_context(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_external_handoff_context(uuid,text) TO service_role;

-- Only the actual parser/download server boundary supplies the calculated hash
-- for a canonical owner path without an older W165 hash. All source/version
-- fields still compare exactly. A present finalized hash must also agree.
CREATE FUNCTION public.journey_bind_external_ldc(p_current jsonb,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_current->>'handoff_type'<>'e4' THEN RETURN p_current; END IF;
  IF p_expected->'ldc'->>'content_sha256' IS NULL OR p_expected->'ldc'->>'content_sha256' !~ '^[0-9a-f]{64}$'
    OR (p_current-'ldc') IS DISTINCT FROM (p_expected-'ldc')
    OR ((p_current->'ldc')-'content_sha256') IS DISTINCT FROM ((p_expected->'ldc')-'content_sha256')
    OR (p_current->'ldc'->>'content_sha256' IS NOT NULL AND p_current->'ldc'->>'content_sha256' IS DISTINCT FROM p_expected->'ldc'->>'content_sha256')
  THEN RAISE EXCEPTION 'external_handoff_context_changed'; END IF;
  RETURN p_expected;
END $$;
REVOKE ALL ON FUNCTION public.journey_bind_external_ldc(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.journey_stage_external_ldc(p_match_id uuid,p_expected_context jsonb,p_operation_key uuid,p_staff_user_id text,p_staff_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE stage public.pursuit_ldc_staging%ROWTYPE; version public.pursuit_ldc_versions%ROWTYPE; ldc_source_key text; stage_id uuid:=gen_random_uuid();
BEGIN
  IF NOT public.w196_staff_role_matches(p_staff_user_id,p_staff_email) THEN RAISE EXCEPTION 'external_handoff_staff_denied'; END IF;
  IF p_expected_context->>'handoff_type' IS DISTINCT FROM 'e4' OR p_operation_key IS NULL THEN RAISE EXCEPTION 'external_ldc_stage_invalid'; END IF;
  PERFORM 1 FROM public.pursuit_external_handoff_settings WHERE singleton AND enabled FOR SHARE NOWAIT;
  IF NOT FOUND OR NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'external_handoff_recording_disabled'; END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  PERFORM 1 FROM public.opportunities WHERE id=(p_expected_context->>'opportunity_id')::uuid FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.repreneurs WHERE id=(p_expected_context->>'repreneur_id')::uuid FOR SHARE NOWAIT;
  PERFORM pg_advisory_xact_lock(hashtextextended('external-handoff:'||p_operation_key::text,0));
  PERFORM public.journey_bind_external_ldc(public.journey_external_handoff_context(p_match_id,'e4'),p_expected_context);
  SELECT * INTO stage FROM public.pursuit_ldc_staging WHERE operation_key=p_operation_key;
  IF stage.id IS NOT NULL THEN
    IF stage.match_id IS DISTINCT FROM p_match_id OR stage.context IS DISTINCT FROM p_expected_context
      OR stage.staff_user_id IS DISTINCT FROM p_staff_user_id OR stage.staff_email IS DISTINCT FROM lower(btrim(p_staff_email))
      OR stage.state NOT IN ('pending','retained') OR (stage.state='pending' AND stage.expires_at<=clock_timestamp())
    THEN RAISE EXCEPTION 'external_ldc_stage_conflict'; END IF;
  ELSE
    ldc_source_key:=encode(extensions.digest(jsonb_build_array(p_expected_context->>'repreneur_id',p_expected_context->'is_demo',p_expected_context->'ldc')::text,'sha256'),'hex');
    SELECT * INTO version FROM public.pursuit_ldc_versions WHERE pursuit_ldc_versions.source_key=ldc_source_key;
    INSERT INTO public.pursuit_ldc_staging(id,operation_key,match_id,staff_user_id,staff_email,context,storage_path,version_id,state)
    VALUES(stage_id,p_operation_key,p_match_id,p_staff_user_id,lower(btrim(p_staff_email)),p_expected_context,
      coalesce(version.storage_path,'pursuit-ldc-evidence/'||(p_expected_context->>'repreneur_id')||'/ldc/'||p_operation_key::text||'/'||stage_id::text||'.pdf'),version.id,
      CASE WHEN version.id IS NULL THEN 'pending' ELSE 'retained' END) RETURNING * INTO stage;
  END IF;
  RETURN jsonb_build_object('stage_id',stage.id,'storage_path',stage.storage_path,'retained',stage.state='retained');
END $$;
REVOKE ALL ON FUNCTION public.journey_stage_external_ldc(uuid,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_stage_external_ldc(uuid,jsonb,uuid,text,text) TO service_role;

-- Preserve the released transaction and all non-E4 behavior. Bind the parsed
-- actual-byte hash without weakening its complete context comparison.
DO $$ DECLARE definition text; original text; replacement text;
BEGIN
  definition:=pg_get_functiondef('public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid)'::regprocedure);
  original:='current_context:=public.journey_external_handoff_context(m.id,h);';
  replacement:='current_context:=public.journey_bind_external_ldc(public.journey_external_handoff_context(m.id,h),p_expected_context);';
  IF length(definition)-length(replace(definition,original,''))<>length(original) THEN RAISE EXCEPTION 'external_ldc_record_source_drift'; END IF;
  definition:=replace(definition,original,replacement);
  original:='IF public.journey_external_handoff_context(m.id,h) IS DISTINCT FROM current_context';
  replacement:='IF public.journey_bind_external_ldc(public.journey_external_handoff_context(m.id,h),p_expected_context) IS DISTINCT FROM current_context';
  IF length(definition)-length(replace(definition,original,''))<>length(original) THEN RAISE EXCEPTION 'external_ldc_recheck_source_drift'; END IF;
  EXECUTE replace(definition,original,replacement);
END $$;
ALTER FUNCTION public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) RENAME TO journey_record_external_handoff_before_ldc;
REVOKE ALL ON FUNCTION public.journey_record_external_handoff_before_ldc(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.journey_external_ldc_replay(p_operation_key uuid,p_match_id uuid,p_context jsonb,p_exchange_date date,p_exchange_time time,p_channel text,p_reference text,p_staff_user_id text,p_staff_email text,p_workspace_id uuid DEFAULT NULL,p_workspace_generation uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt public.opportunity_pursuit_external_handoffs%ROWTYPE;
BEGIN
  IF NOT public.w196_staff_role_matches(p_staff_user_id,p_staff_email) THEN RAISE EXCEPTION 'external_handoff_staff_denied'; END IF;
  IF p_workspace_id IS NOT NULL OR p_workspace_generation IS NOT NULL THEN
    PERFORM public.w196_assert_staff_portal_workspace(p_workspace_id,p_workspace_generation,(p_context->>'repreneur_id')::uuid,p_staff_user_id,p_staff_email);
  END IF;
  SELECT * INTO receipt FROM public.opportunity_pursuit_external_handoffs WHERE operation_key=p_operation_key;
  IF receipt.id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_matches m JOIN public.repreneurs r ON r.id=m.repreneur_id
    JOIN public.opportunities o ON o.id=m.opportunity_id WHERE m.id=receipt.match_id AND m.repreneur_id=receipt.repreneur_id
      AND o.id=receipt.opportunity_id AND r.is_demo=(receipt.context->>'is_demo')::boolean AND o.is_demo=r.is_demo)
  THEN RAISE EXCEPTION 'external_ldc_owner_or_namespace_invalid'; END IF;
  IF receipt.handoff_type<>'e4' OR receipt.match_id IS DISTINCT FROM p_match_id OR receipt.context IS DISTINCT FROM p_context
    OR receipt.exchange_date IS DISTINCT FROM p_exchange_date OR receipt.exchange_time IS DISTINCT FROM p_exchange_time
    OR receipt.channel IS DISTINCT FROM p_channel OR receipt.reference IS DISTINCT FROM btrim(p_reference)
    OR receipt.staff_user_id IS DISTINCT FROM p_staff_user_id OR receipt.staff_email IS DISTINCT FROM lower(btrim(p_staff_email))
    OR NOT EXISTS(SELECT 1 FROM public.pursuit_external_ldc_receipts WHERE receipt_id=receipt.id)
  THEN RAISE EXCEPTION 'external_handoff_retry_conflict'; END IF;
  RETURN receipt.evidence_id;
END $$;
REVOKE ALL ON FUNCTION public.journey_external_ldc_replay(uuid,uuid,jsonb,date,time,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_external_ldc_replay(uuid,uuid,jsonb,date,time,text,text,text,text,uuid,uuid) TO service_role;

CREATE FUNCTION public.journey_record_external_handoff(p_match_id uuid,p_expected_context jsonb,p_operation_key uuid,p_exchange_date date,p_exchange_time time,p_channel text,p_reference text,p_staff_user_id text,p_staff_email text,p_workspace_id uuid DEFAULT NULL,p_workspace_generation uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage,pg_temp AS $$
DECLARE stage public.pursuit_ldc_staging%ROWTYPE; version public.pursuit_ldc_versions%ROWTYPE;
  source jsonb; ldc_source_key text; event_id uuid; receipt_id uuid; retained_object storage.objects%ROWTYPE;
BEGIN
  IF p_expected_context->>'handoff_type' IS DISTINCT FROM 'e4' THEN
    RETURN public.journey_record_external_handoff_before_ldc(p_match_id,p_expected_context,p_operation_key,p_exchange_date,p_exchange_time,p_channel,p_reference,p_staff_user_id,p_staff_email,p_workspace_id,p_workspace_generation);
  END IF;
  IF NOT public.w196_staff_role_matches(p_staff_user_id,p_staff_email) THEN RAISE EXCEPTION 'external_handoff_staff_denied'; END IF;
  IF p_workspace_id IS NOT NULL OR p_workspace_generation IS NOT NULL THEN
    PERFORM public.w196_assert_staff_portal_workspace(p_workspace_id,p_workspace_generation,(p_expected_context->>'repreneur_id')::uuid,p_staff_user_id,p_staff_email);
  END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  PERFORM 1 FROM public.opportunities WHERE id=(p_expected_context->>'opportunity_id')::uuid FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.repreneurs WHERE id=(p_expected_context->>'repreneur_id')::uuid FOR SHARE NOWAIT;
  PERFORM pg_advisory_xact_lock(hashtextextended('external-handoff:'||p_operation_key::text,0));
  event_id:=public.journey_external_ldc_replay(p_operation_key,p_match_id,p_expected_context,p_exchange_date,p_exchange_time,p_channel,p_reference,p_staff_user_id,p_staff_email);
  IF event_id IS NOT NULL THEN RETURN event_id; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id='cvs' AND id=(p_expected_context->'ldc'->>'source_object_id')::uuid FOR SHARE NOWAIT;
  source:=public.journey_bind_external_ldc(public.journey_external_handoff_context(p_match_id,'e4'),p_expected_context)->'ldc';
  SELECT * INTO stage FROM public.pursuit_ldc_staging WHERE operation_key=p_operation_key FOR UPDATE;
  IF stage.id IS NULL OR stage.state NOT IN ('pending','retained') OR (stage.state='pending' AND stage.expires_at<=clock_timestamp())
    OR stage.match_id IS DISTINCT FROM p_match_id OR stage.context IS DISTINCT FROM p_expected_context
    OR stage.staff_user_id IS DISTINCT FROM p_staff_user_id OR stage.staff_email IS DISTINCT FROM lower(btrim(p_staff_email))
  THEN RAISE EXCEPTION 'external_ldc_stage_invalid'; END IF;
  SELECT * INTO retained_object FROM storage.objects WHERE bucket_id='cvs' AND name=stage.storage_path FOR SHARE NOWAIT;
  IF retained_object.id IS NULL OR nullif(retained_object.version,'') IS NULL
    OR retained_object.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
    OR retained_object.metadata->>'size' IS DISTINCT FROM source->>'size_bytes'
    OR retained_object.user_metadata->>'sha256' IS DISTINCT FROM source->>'content_sha256'
  THEN RAISE EXCEPTION 'external_ldc_retained_bytes_missing'; END IF;
  ldc_source_key:=encode(extensions.digest(jsonb_build_array(p_expected_context->>'repreneur_id',p_expected_context->'is_demo',source)::text,'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('external-ldc-version:'||ldc_source_key,0));
  SELECT * INTO version FROM public.pursuit_ldc_versions WHERE pursuit_ldc_versions.source_key=ldc_source_key;
  IF version.id IS NULL THEN
    INSERT INTO public.pursuit_ldc_versions(repreneur_id,is_demo,source,source_key,storage_path,storage_object_id,storage_object_version,content_sha256,size_bytes)
    VALUES((p_expected_context->>'repreneur_id')::uuid,(p_expected_context->>'is_demo')::boolean,source,ldc_source_key,stage.storage_path,retained_object.id,retained_object.version,source->>'content_sha256',(source->>'size_bytes')::bigint)
    RETURNING * INTO version;
  END IF;
  event_id:=public.journey_record_external_handoff_before_ldc(p_match_id,p_expected_context,p_operation_key,p_exchange_date,p_exchange_time,p_channel,p_reference,p_staff_user_id,p_staff_email,p_workspace_id,p_workspace_generation);
  SELECT id INTO receipt_id FROM public.opportunity_pursuit_external_handoffs WHERE operation_key=p_operation_key;
  INSERT INTO public.pursuit_external_ldc_receipts(receipt_id,version_id) VALUES(receipt_id,version.id);
  UPDATE public.pursuit_ldc_staging SET version_id=version.id,state=CASE WHEN storage_path=version.storage_path THEN 'retained' ELSE 'cleanup' END WHERE id=stage.id;
  RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) TO service_role;

-- Commit uncertainty is resolved here under the same operation lock. Claiming
-- cleanup makes a stage permanently unfinalizable before Storage DELETE.
-- A late successful upload can outlive cleanup. Reclaim its terminal tombstone
-- only when the actual object has reappeared; empty tombstones consume no batch.
CREATE FUNCTION public.journey_claim_ldc_cleanup(p_stage_id uuid DEFAULT NULL,p_operation_key uuid DEFAULT NULL,p_staff_user_id text DEFAULT NULL) RETURNS SETOF public.pursuit_ldc_staging
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE candidate public.pursuit_ldc_staging%ROWTYPE;
BEGIN
  FOR candidate IN SELECT stage_row.* FROM public.pursuit_ldc_staging stage_row
    WHERE (stage_row.state IN ('pending','cleanup') OR (stage_row.state='cleaned'
      AND EXISTS(SELECT 1 FROM storage.objects object_row WHERE object_row.bucket_id='cvs' AND object_row.name=stage_row.storage_path)))
    AND NOT EXISTS(SELECT 1 FROM public.pursuit_ldc_versions WHERE storage_path=stage_row.storage_path)
    AND ((p_stage_id IS NOT NULL AND stage_row.id=p_stage_id AND stage_row.operation_key=p_operation_key AND stage_row.staff_user_id=p_staff_user_id)
      OR (p_stage_id IS NULL AND (stage_row.state IN ('cleanup','cleaned') OR stage_row.expires_at<=clock_timestamp())))
    ORDER BY stage_row.recorded_at LIMIT 20 LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('external-handoff:'||candidate.operation_key::text,0)) THEN CONTINUE; END IF;
    SELECT * INTO candidate FROM public.pursuit_ldc_staging WHERE id=candidate.id FOR UPDATE SKIP LOCKED;
    IF candidate.id IS NULL OR candidate.state NOT IN ('pending','cleanup','cleaned')
      OR EXISTS(SELECT 1 FROM public.pursuit_ldc_versions WHERE storage_path=candidate.storage_path)
      OR (candidate.state='cleaned' AND NOT EXISTS(SELECT 1 FROM storage.objects object_row
        WHERE object_row.bucket_id='cvs' AND object_row.name=candidate.storage_path)) THEN CONTINUE; END IF;
    UPDATE public.pursuit_ldc_staging SET state='cleanup' WHERE id=candidate.id RETURNING * INTO candidate;
    RETURN NEXT candidate;
  END LOOP;
END $$;
CREATE FUNCTION public.journey_complete_ldc_cleanup(p_stage_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  UPDATE public.pursuit_ldc_staging SET state='cleaned' WHERE id=p_stage_id AND state='cleanup'
    AND NOT EXISTS(SELECT 1 FROM public.pursuit_ldc_versions WHERE storage_path=pursuit_ldc_staging.storage_path);
$$;
REVOKE ALL ON FUNCTION public.journey_claim_ldc_cleanup(uuid,uuid,text),public.journey_complete_ldc_cleanup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_claim_ldc_cleanup(uuid,uuid,text),public.journey_complete_ldc_cleanup(uuid) TO service_role;
COMMENT ON TABLE public.pursuit_ldc_versions IS 'Exact private versions of the existing Fiche/LDC for new external E4 receipts; no TTL, backfill or email delivery assertion.';

CREATE FUNCTION public.journey_retained_ldc_for_actor(p_receipt_id uuid,p_actor_user_id text,p_actor_email text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE receipt public.opportunity_pursuit_external_handoffs%ROWTYPE; version public.pursuit_ldc_versions%ROWTYPE;
  actor_owner uuid;
BEGIN
  SELECT * INTO receipt FROM public.opportunity_pursuit_external_handoffs WHERE id=p_receipt_id AND handoff_type='e4';
  SELECT version_row.* INTO version FROM public.pursuit_external_ldc_receipts link
    JOIN public.pursuit_ldc_versions version_row ON version_row.id=link.version_id WHERE link.receipt_id=receipt.id;
  IF version.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.repreneurs r JOIN public.opportunities o ON o.id=receipt.opportunity_id
    WHERE r.id=receipt.repreneur_id AND r.is_demo=version.is_demo AND o.is_demo=version.is_demo)
  THEN RETURN NULL; END IF;
  IF NOT public.w196_staff_role_matches(p_actor_user_id,p_actor_email) THEN
    SELECT repreneur_id INTO actor_owner FROM public.app_user_roles WHERE user_id=p_actor_user_id
      AND lower(email)=lower(btrim(p_actor_email)) AND role='repreneur';
    IF actor_owner IS DISTINCT FROM receipt.repreneur_id OR NOT EXISTS(SELECT 1 FROM public.opportunity_matches m
      JOIN public.opportunities o ON o.id=m.opportunity_id WHERE m.id=receipt.match_id AND m.repreneur_id=actor_owner
      AND m.status='active_pursuit' AND o.status='active') THEN RETURN NULL; END IF;
  END IF;
  RETURN jsonb_build_object('storage_path',version.storage_path,'content_sha256',version.content_sha256,'size_bytes',version.size_bytes);
END $$;
REVOKE ALL ON FUNCTION public.journey_retained_ldc_for_actor(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_retained_ldc_for_actor(uuid,text,text) TO service_role;
COMMIT;
