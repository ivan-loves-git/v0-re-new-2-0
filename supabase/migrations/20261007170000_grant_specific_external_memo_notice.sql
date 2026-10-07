-- #248 / #255: an exact platform disclosure and an already external notice.
-- Additive versioned lane; legacy receipts/finalizers remain unattributed facts.
BEGIN;
ALTER TABLE public.opportunity_pursuit_confidential_grants ADD COLUMN grant_evidence_id uuid REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT;
CREATE TABLE public.opportunity_memo_grant_snapshots (
 grant_evidence_id uuid PRIMARY KEY REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
 match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
 opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
 repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
 context jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.opportunity_memo_grant_notices (
 grant_evidence_id uuid PRIMARY KEY REFERENCES public.opportunity_memo_grant_snapshots(grant_evidence_id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','review','deferred','rejected','uncertain','sent','external')),
 attempt_token uuid, attempt_count integer NOT NULL DEFAULT 0, attempted_at timestamptz,
 provider_id text, sent_at timestamptz, last_error text
);
CREATE TABLE public.opportunity_memo_external_notices (
 grant_evidence_id uuid PRIMARY KEY REFERENCES public.opportunity_memo_grant_snapshots(grant_evidence_id) ON DELETE RESTRICT,
 operation_key uuid NOT NULL UNIQUE, context jsonb NOT NULL,
 memo_sha256 text NOT NULL CHECK(memo_sha256 ~ '^[0-9a-f]{64}$'),
 exchange_date date NOT NULL, exchange_time time(0), exchange_timezone text NOT NULL DEFAULT 'Europe/Paris' CHECK(exchange_timezone='Europe/Paris'),
 channel text NOT NULL CHECK(channel IN ('email','phone','meeting','other')),
 reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 5 AND 500),
 staff_user_id text NOT NULL, staff_email text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.opportunity_memo_grant_attempts (
 token uuid PRIMARY KEY, grant_evidence_id uuid NOT NULL REFERENCES public.opportunity_memo_grant_snapshots(grant_evidence_id) ON DELETE RESTRICT,
 started_at timestamptz NOT NULL, outcome text CHECK(outcome IN ('review','deferred','rejected','uncertain','sent')),
 provider_id text, finished_at timestamptz,
 reconciled_outcome text CHECK(reconciled_outcome IN ('rejected','sent')),
 reconciled_provider_id text, reconciled_at timestamptz,
 CHECK(reconciled_outcome IS NULL OR outcome='uncertain')
);
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['opportunity_memo_grant_snapshots','opportunity_memo_grant_notices','opportunity_memo_external_notices','opportunity_memo_grant_attempts'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',relation);
 EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',relation);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',relation);
 EXECUTE format('GRANT SELECT ON public.%I TO service_role',relation);
 END LOOP;
END $$;
CREATE TRIGGER memo_grant_snapshot_immutable BEFORE UPDATE OR DELETE ON public.opportunity_memo_grant_snapshots FOR EACH ROW EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER memo_grant_snapshot_no_truncate BEFORE TRUNCATE ON public.opportunity_memo_grant_snapshots FOR EACH STATEMENT EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER memo_external_notice_immutable BEFORE UPDATE OR DELETE ON public.opportunity_memo_external_notices FOR EACH ROW EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER memo_external_notice_no_truncate BEFORE TRUNCATE ON public.opportunity_memo_external_notices FOR EACH STATEMENT EXECUTE FUNCTION public.reject_external_handoff_mutation();

CREATE FUNCTION public.journey_external_memo_context(p_match_id uuid,p_document_id uuid,p_nda_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE context jsonb; memo public.opportunity_documents%ROWTYPE; dispatch_id uuid; recipient_required boolean;
BEGIN
 context:=public.journey_external_handoff_context(p_match_id,'e7');
 SELECT id INTO dispatch_id FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='e7_signed_copies_and_memo_requested'
 AND metadata->>'upstream_evidence_id'=context->>'upstream_id' AND public.journey_handoff_is_qualifying(id) ORDER BY recorded_at DESC,id DESC LIMIT 1;
 SELECT * INTO memo FROM public.opportunity_documents WHERE id=p_document_id;
 SELECT recipient_im_required INTO recipient_required FROM public.opportunities WHERE id=(context->>'opportunity_id')::uuid;
 IF dispatch_id IS NULL OR p_nda_expires_at IS NULL OR p_nda_expires_at<=clock_timestamp()
 OR memo.id IS NULL OR memo.opportunity_id::text IS DISTINCT FROM context->>'opportunity_id'
 OR memo.document_type<>'deal_book' OR memo.visibility<>'staff_only' OR memo.external_url IS NOT NULL
 OR memo.storage_bucket IS DISTINCT FROM 'opportunity-documents' OR memo.storage_path NOT LIKE (context->>'opportunity_id')||'/%'
 OR memo.storage_path IS NULL OR memo.mime_type IS DISTINCT FROM 'application/pdf' OR lower(memo.file_name) NOT LIKE '%.pdf'
 OR memo.size_bytes IS NULL OR memo.size_bytes NOT BETWEEN 1 AND 20971520
 OR EXISTS(SELECT 1 FROM public.recipient_im_cleanup WHERE document_id=memo.id)
 OR (recipient_required AND memo.recipient_match_id IS NULL)
 OR (memo.recipient_match_id IS NOT NULL AND (memo.recipient_match_id<>p_match_id OR memo.recipient_repreneur_id::text IS DISTINCT FROM context->>'repreneur_id'))
 THEN RAISE EXCEPTION 'external_memo_prerequisites_changed'; END IF;
 RETURN context||jsonb_build_object('e7_evidence_id',dispatch_id,'nda_expires_at',p_nda_expires_at,
 'memo',jsonb_build_object('document_id',memo.id,'storage_bucket',memo.storage_bucket,'storage_path',memo.storage_path,
 'file_name',memo.file_name,'mime_type',memo.mime_type,'size_bytes',memo.size_bytes,'recipient_match_id',memo.recipient_match_id,'recipient_repreneur_id',memo.recipient_repreneur_id));
END $$;
-- Each future approval gets its own E8; a revoked grant's event cannot be reused.
DO $$ DECLARE definition text; old text:='''e8:''||v_cycle::TEXT||'':''||v_gate2::TEXT||'':''||v_doc.id::TEXT'; BEGIN
 definition:=pg_get_functiondef('public.journey_grant_confidential_access(uuid,uuid,text,text,timestamptz)'::regprocedure);
 IF position(old in definition)=0 THEN RAISE EXCEPTION 'memo_grant_definition_drift'; END IF;
 EXECUTE replace(definition,old,'''e8:''||v_event::TEXT');
END $$;
ALTER FUNCTION public.journey_grant_confidential_access(uuid,uuid,text,text,timestamptz) RENAME TO journey_grant_confidential_access_pre255;
CREATE FUNCTION public.journey_grant_confidential_access(p_match_id uuid,p_information_memo_document_id uuid,p_actor text,p_idempotency_key text,p_nda_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE match public.opportunity_matches%ROWTYPE; grant_id uuid; existing_ids uuid[]; context jsonb;
BEGIN
 SELECT * INTO match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
 PERFORM 1 FROM public.opportunities WHERE id=match.opportunity_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.repreneurs WHERE id=match.repreneur_id FOR SHARE NOWAIT;
 IF NOT public.w164_match_has_same_namespace(match.id) THEN RAISE EXCEPTION 'memo_grant_namespace_changed'; END IF;
 SELECT array_agg(id) INTO existing_ids FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='confidential_access_granted';
 grant_id:=public.journey_grant_confidential_access_pre255(p_match_id,p_information_memo_document_id,p_actor,p_idempotency_key,p_nda_expires_at);
 IF NOT (grant_id=ANY(coalesce(existing_ids,'{}'::uuid[]))) THEN
   UPDATE public.opportunity_pursuit_confidential_grants SET grant_evidence_id=NULL WHERE match_id=p_match_id;
   -- Old code's first ordinary disclosure remains on its compatible legacy lane.
   -- Once a versioned disclosure exists, an old entry cannot remap its callbacks onto a future grant.
   IF current_setting('wave.memo_grant_versioned',true)='on' OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots WHERE match_id=p_match_id) THEN
     context:=public.journey_external_memo_context(p_match_id,p_information_memo_document_id,p_nda_expires_at);
     INSERT INTO public.opportunity_memo_grant_snapshots VALUES(grant_id,match.id,match.opportunity_id,match.repreneur_id,context,clock_timestamp());
     INSERT INTO public.opportunity_memo_grant_notices(grant_evidence_id) VALUES(grant_id);
     UPDATE public.opportunity_pursuit_confidential_grants SET grant_evidence_id=grant_id WHERE match_id=p_match_id;
   END IF;
 END IF;
 RETURN grant_id;
END $$;
CREATE FUNCTION public.journey_grant_confidential_access_v2(p_match_id uuid,p_information_memo_document_id uuid,p_actor text,p_idempotency_key text,p_nda_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grant_id uuid; BEGIN
 PERFORM set_config('wave.memo_grant_versioned','on',true);
 grant_id:=public.journey_grant_confidential_access(p_match_id,p_information_memo_document_id,p_actor,p_idempotency_key,p_nda_expires_at);
 PERFORM set_config('wave.memo_grant_versioned','',true);
 RETURN grant_id;
END $$;
CREATE FUNCTION public.journey_memo_grant_is_current(p_grant_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE snapshot public.opportunity_memo_grant_snapshots%ROWTYPE; current_context jsonb; BEGIN
 SELECT * INTO snapshot FROM public.opportunity_memo_grant_snapshots WHERE grant_evidence_id=p_grant_id;
 IF snapshot.grant_evidence_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=snapshot.match_id AND g.grant_evidence_id=p_grant_id
 AND public.journey_repreneur_can_access_confidential(g.match_id,snapshot.repreneur_id,g.information_memo_document_id)) THEN RETURN false; END IF;
 BEGIN current_context:=public.journey_external_memo_context(snapshot.match_id,(snapshot.context->'memo'->>'document_id')::uuid,(snapshot.context->>'nda_expires_at')::timestamptz);
 EXCEPTION WHEN raise_exception THEN RETURN false; END;
 RETURN current_context=snapshot.context;
END $$;

-- Keep the actual portal/staff document RPC compatible, with exact snapshots
-- for new grants. An old app cannot serve a replacement object under grant A.
ALTER FUNCTION public.journey_repreneur_can_access_confidential(uuid,uuid,uuid) RENAME TO journey_repreneur_can_access_confidential_pre255;
CREATE FUNCTION public.journey_repreneur_can_access_confidential(p_match_id uuid,p_repreneur_id uuid,p_document_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grant_id uuid; snapshot_context jsonb; current_context jsonb; BEGIN
 IF NOT public.journey_repreneur_can_access_confidential_pre255(p_match_id,p_repreneur_id,p_document_id) THEN RETURN false; END IF;
 SELECT grant_evidence_id INTO grant_id FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id;
 IF grant_id IS NULL THEN RETURN true; END IF;
 SELECT context INTO snapshot_context FROM public.opportunity_memo_grant_snapshots WHERE grant_evidence_id=grant_id AND match_id=p_match_id AND repreneur_id=p_repreneur_id;
 IF snapshot_context IS NULL THEN RETURN false; END IF;
 BEGIN current_context:=public.journey_external_memo_context(p_match_id,p_document_id,(snapshot_context->>'nda_expires_at')::timestamptz);
 EXCEPTION WHEN raise_exception THEN RETURN false; END;
 RETURN snapshot_context=current_context;
END $$;

CREATE FUNCTION public.journey_approve_memo_external_notice(p_match_id uuid,p_expected_context jsonb,p_memo_sha256 text,
 p_operation_key uuid,p_exchange_date date,p_exchange_time time,p_channel text,p_reference text,p_staff_user_id text,p_staff_email text,
 p_workspace_id uuid DEFAULT NULL,p_workspace_generation uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE match public.opportunity_matches%ROWTYPE; receipt public.opportunity_memo_external_notices%ROWTYPE; context jsonb; grant_id uuid;
 local_now timestamp:=clock_timestamp() AT TIME ZONE 'Europe/Paris';
BEGIN
 IF NOT public.w196_staff_role_matches(p_staff_user_id,p_staff_email) THEN RAISE EXCEPTION 'external_memo_staff_denied'; END IF;
 IF p_workspace_id IS NOT NULL OR p_workspace_generation IS NOT NULL THEN
 PERFORM public.w196_assert_staff_portal_workspace(p_workspace_id,p_workspace_generation,(p_expected_context->>'repreneur_id')::uuid,p_staff_user_id,p_staff_email); END IF;
 PERFORM 1 FROM public.pursuit_external_handoff_settings WHERE singleton AND enabled FOR SHARE NOWAIT;
 IF NOT FOUND OR NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'external_handoff_recording_disabled'; END IF;
 IF p_operation_key IS NULL OR p_memo_sha256 IS NULL OR p_memo_sha256 !~ '^[0-9a-f]{64}$'
 OR p_exchange_date IS NULL OR p_exchange_date>local_now::date
 OR (p_exchange_time IS NOT NULL AND (extract(second FROM p_exchange_time)<>0 OR p_exchange_date+p_exchange_time>local_now))
 OR p_channel IS NULL OR p_channel NOT IN ('email','phone','meeting','other') OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 5 AND 500
 THEN RAISE EXCEPTION 'external_handoff_metadata_invalid'; END IF;
 SELECT * INTO match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
 PERFORM 1 FROM public.opportunities WHERE id=match.opportunity_id FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.repreneurs WHERE id=match.repreneur_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.ma_offices office JOIN public.ma_firms firm ON firm.id=office.firm_id WHERE office.id=(p_expected_context->>'source_office_id')::uuid FOR SHARE OF office,firm NOWAIT;
 PERFORM 1 FROM public.opportunity_documents WHERE id=(p_expected_context->'memo'->>'document_id')::uuid FOR SHARE NOWAIT;
 PERFORM 1 FROM public.opportunity_nda_artifacts a JOIN public.opportunity_documents d ON d.id=a.document_id
 WHERE a.id IN(SELECT (value->>'artifact_id')::uuid FROM jsonb_array_elements(p_expected_context->'documents')) FOR SHARE OF a,d NOWAIT;
 PERFORM 1 FROM public.staff_email_reviews WHERE business_match_id=p_match_id AND template_key='opportunity_memo_available' FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.opportunity_memo_notifications WHERE match_id=p_match_id FOR UPDATE NOWAIT;
 PERFORM pg_advisory_xact_lock(hashtextextended('external-memo:'||p_operation_key::text,0));
 context:=public.journey_external_memo_context(p_match_id,(p_expected_context->'memo'->>'document_id')::uuid,(p_expected_context->>'nda_expires_at')::timestamptz);
 IF context IS DISTINCT FROM p_expected_context THEN RAISE EXCEPTION 'external_memo_context_changed'; END IF;
 SELECT * INTO receipt FROM public.opportunity_memo_external_notices WHERE operation_key=p_operation_key;
 IF receipt.grant_evidence_id IS NOT NULL THEN
 IF receipt.context IS DISTINCT FROM context OR receipt.memo_sha256 IS DISTINCT FROM p_memo_sha256 OR receipt.exchange_date IS DISTINCT FROM p_exchange_date
 OR receipt.exchange_time IS DISTINCT FROM p_exchange_time OR receipt.channel IS DISTINCT FROM p_channel OR receipt.reference IS DISTINCT FROM btrim(p_reference)
 OR receipt.staff_user_id IS DISTINCT FROM p_staff_user_id OR receipt.staff_email IS DISTINCT FROM lower(btrim(p_staff_email)) OR NOT public.journey_memo_grant_is_current(receipt.grant_evidence_id)
 THEN RAISE EXCEPTION 'external_memo_retry_conflict'; END IF;
 RETURN receipt.grant_evidence_id; END IF;
 -- A legacy attempted/accepted disclosure is never promoted to external evidence.
 IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id AND revoked_at IS NULL AND grant_evidence_id IS NULL)
 OR EXISTS(SELECT 1 FROM public.opportunity_memo_notifications WHERE match_id=p_match_id AND (status='sending' OR (status='failed' AND attempt_count>0 AND last_error IS DISTINCT FROM 'Prepared for staff review; no email sent.')))
 OR EXISTS(SELECT 1 FROM public.staff_email_reviews r WHERE r.business_match_id=p_match_id AND r.template_key='opportunity_memo_available' AND r.state IN ('sending','uncertain')
   AND (r.source_context->>'grantEvidenceId' IS NULL OR r.source_context->>'grantEvidenceId'=(SELECT g.grant_evidence_id::text FROM public.opportunity_pursuit_confidential_grants g WHERE g.match_id=p_match_id AND g.revoked_at IS NULL AND g.nda_expires_at>clock_timestamp())))
 THEN RAISE EXCEPTION 'external_memo_reconciliation_required'; END IF;
 grant_id:=public.journey_grant_confidential_access_v2(p_match_id,(context->'memo'->>'document_id')::uuid,p_staff_user_id,'external-memo:'||p_operation_key::text,(context->>'nda_expires_at')::timestamptz);
 PERFORM 1 FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=grant_id FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=grant_id AND state IN ('sending','uncertain','sent','external'))
 THEN RAISE EXCEPTION 'external_memo_already_completed_or_uncertain'; END IF;
 INSERT INTO public.opportunity_memo_external_notices(grant_evidence_id,operation_key,context,memo_sha256,exchange_date,exchange_time,channel,reference,staff_user_id,staff_email)
 VALUES(grant_id,p_operation_key,context,p_memo_sha256,p_exchange_date,p_exchange_time,p_channel,btrim(p_reference),p_staff_user_id,lower(btrim(p_staff_email)));
 UPDATE public.opportunity_memo_grant_notices SET state='external',attempt_token=NULL WHERE grant_evidence_id=grant_id;
 RETURN grant_id;
END $$;

-- Preserve the old RPC's shape and its unversioned ordinary first approval.
-- No legacy claimant/finalizer can write a versioned notice or consume future B.
ALTER FUNCTION public.claim_opportunity_memo_notification(uuid,uuid,timestamptz) RENAME TO claim_opportunity_memo_notification_pre255;
CREATE FUNCTION public.claim_opportunity_memo_notification(p_opportunity_id uuid,p_match_id uuid DEFAULT NULL,p_attempted_at timestamptz DEFAULT now())
RETURNS TABLE(match_id uuid,opportunity_id uuid,repreneur_id uuid,recipient_email text,repreneur_first_name text,opportunity_title text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE match public.opportunity_matches%ROWTYPE; BEGIN
 FOR match IN SELECT m.* FROM public.opportunity_matches m WHERE m.opportunity_id=p_opportunity_id AND (p_match_id IS NULL OR m.id=p_match_id) ORDER BY m.updated_at DESC LOOP
 PERFORM 1 FROM public.opportunities WHERE id=match.opportunity_id FOR UPDATE;
 PERFORM 1 FROM public.opportunity_matches WHERE id=match.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE public.opportunity_pursuit_confidential_grants.match_id=match.id AND grant_evidence_id IS NOT NULL) THEN CONTINUE; END IF;
 RETURN QUERY SELECT * FROM public.claim_opportunity_memo_notification_pre255(p_opportunity_id,match.id,p_attempted_at);
 IF FOUND THEN RETURN; END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.claim_opportunity_memo_grant_notice(p_opportunity_id uuid,p_match_id uuid,p_expected_grant_id uuid,p_attempted_at timestamptz)
RETURNS TABLE(match_id uuid,opportunity_id uuid,repreneur_id uuid,recipient_email text,repreneur_first_name text,opportunity_title text,grant_evidence_id uuid,attempt_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE snapshot public.opportunity_memo_grant_snapshots%ROWTYPE; token uuid:=gen_random_uuid(); BEGIN
 PERFORM 1 FROM public.opportunities WHERE id=p_opportunity_id FOR UPDATE;
 PERFORM 1 FROM public.opportunity_matches WHERE id=p_match_id AND public.opportunity_matches.opportunity_id=p_opportunity_id FOR UPDATE;
 SELECT s.* INTO snapshot FROM public.opportunity_memo_grant_snapshots s JOIN public.opportunity_pursuit_confidential_grants g ON g.grant_evidence_id=s.grant_evidence_id
 WHERE s.match_id=p_match_id AND (p_expected_grant_id IS NULL OR s.grant_evidence_id=p_expected_grant_id);
 IF snapshot.grant_evidence_id IS NULL THEN
   -- New code can still process an actual unversioned disclosure. Never infer
   -- a historical grant identity for a provider receipt.
   IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE public.opportunity_pursuit_confidential_grants.match_id=p_match_id AND public.opportunity_pursuit_confidential_grants.grant_evidence_id IS NOT NULL)
   AND (p_expected_grant_id IS NULL OR p_expected_grant_id=(SELECT id FROM public.opportunity_pursuit_evidence WHERE public.opportunity_pursuit_evidence.match_id=p_match_id AND event_type='confidential_access_granted' ORDER BY recorded_at DESC,id DESC LIMIT 1)) THEN
     RETURN QUERY SELECT legacy.*,NULL::uuid,NULL::uuid FROM public.claim_opportunity_memo_notification(p_opportunity_id,p_match_id,p_attempted_at) legacy;
   END IF;
   RETURN;
 END IF;
 IF NOT public.journey_memo_grant_is_current(snapshot.grant_evidence_id) OR EXISTS(SELECT 1 FROM public.repreneurs WHERE id=snapshot.repreneur_id AND (is_demo OR nullif(btrim(email),'') IS NULL)) THEN RETURN; END IF;
 UPDATE public.opportunity_memo_grant_notices n SET state='sending',attempt_token=token,attempt_count=attempt_count+1,attempted_at=p_attempted_at,last_error=NULL
 WHERE n.grant_evidence_id=snapshot.grant_evidence_id AND n.state IN ('pending','review','deferred','rejected');
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.opportunity_memo_grant_attempts(token,grant_evidence_id,started_at) VALUES(token,snapshot.grant_evidence_id,p_attempted_at);
 RETURN QUERY SELECT snapshot.match_id,snapshot.opportunity_id,snapshot.repreneur_id,btrim(r.email),coalesce(nullif(btrim(r.first_name),''),'Madame, Monsieur'),coalesce(nullif(btrim(o.public_title),''),'votre opportunite'),snapshot.grant_evidence_id,token
 FROM public.repreneurs r JOIN public.opportunities o ON o.id=snapshot.opportunity_id WHERE r.id=snapshot.repreneur_id;
END $$;
CREATE FUNCTION public.finish_opportunity_memo_grant_notice(p_grant_id uuid,p_token uuid,p_outcome text,p_provider_id text,p_finished_at timestamptz,p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE attempt public.opportunity_memo_grant_attempts%ROWTYPE; BEGIN
 SELECT * INTO attempt FROM public.opportunity_memo_grant_attempts WHERE token=p_token AND grant_evidence_id=p_grant_id FOR UPDATE;
 IF attempt.token IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('review','deferred','rejected','uncertain','sent') OR (p_outcome='sent' AND nullif(btrim(p_provider_id),'') IS NULL) OR (p_outcome<>'sent' AND p_provider_id IS NOT NULL)
 THEN RAISE EXCEPTION 'memo_notice_outcome_invalid'; END IF;
 IF attempt.outcome IS NOT NULL THEN
 IF attempt.outcome=p_outcome AND attempt.provider_id IS NOT DISTINCT FROM p_provider_id THEN RETURN; END IF;
 -- An actual provider correlation may settle this exact unknown attempt. Keep
 -- its original uncertainty and recording instant; never mutate a future grant.
 IF attempt.outcome='uncertain' AND p_outcome IN ('sent','rejected') THEN
   IF attempt.reconciled_outcome IS NOT NULL THEN
     IF attempt.reconciled_outcome=p_outcome AND attempt.reconciled_provider_id IS NOT DISTINCT FROM p_provider_id THEN RETURN; END IF;
     RAISE EXCEPTION 'memo_notice_outcome_conflict';
   END IF;
   UPDATE public.opportunity_memo_grant_attempts SET reconciled_outcome=p_outcome,reconciled_provider_id=p_provider_id,reconciled_at=p_finished_at WHERE token=p_token;
   UPDATE public.opportunity_memo_grant_notices SET state=p_outcome,attempt_token=NULL,provider_id=p_provider_id,sent_at=CASE WHEN p_outcome='sent' THEN p_finished_at END,last_error=left(p_error,1000)
   WHERE grant_evidence_id=p_grant_id AND attempt_token=p_token AND state='uncertain';
   IF NOT FOUND THEN RAISE EXCEPTION 'memo_notice_attempt_stale'; END IF;
   RETURN;
 END IF;
 RAISE EXCEPTION 'memo_notice_outcome_conflict'; END IF;
 UPDATE public.opportunity_memo_grant_attempts SET outcome=p_outcome,provider_id=p_provider_id,finished_at=p_finished_at WHERE token=p_token;
 UPDATE public.opportunity_memo_grant_notices SET state=p_outcome,attempt_token=CASE WHEN p_outcome='uncertain' THEN p_token END,provider_id=p_provider_id,sent_at=CASE WHEN p_outcome='sent' THEN p_finished_at END,last_error=left(p_error,1000)
 WHERE grant_evidence_id=p_grant_id AND attempt_token=p_token AND state='sending';
 IF NOT FOUND THEN RAISE EXCEPTION 'memo_notice_attempt_stale'; END IF;
END $$;
CREATE FUNCTION public.authorize_opportunity_memo_grant_attempt(p_grant_id uuid,p_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE snapshot public.opportunity_memo_grant_snapshots%ROWTYPE; BEGIN
 SELECT * INTO snapshot FROM public.opportunity_memo_grant_snapshots WHERE grant_evidence_id=p_grant_id;
 PERFORM 1 FROM public.opportunities WHERE id=snapshot.opportunity_id FOR UPDATE;
 PERFORM 1 FROM public.opportunity_matches WHERE id=snapshot.match_id FOR UPDATE;
 RETURN public.journey_memo_grant_is_current(p_grant_id) AND EXISTS(SELECT 1 FROM public.opportunity_memo_grant_notices WHERE grant_evidence_id=p_grant_id AND state='sending' AND attempt_token=p_token);
END $$;
-- These gates run before preparation/reservation changes, and immediately before
-- provider entry. Legacy source contexts can only authorize the legacy lane.
CREATE FUNCTION public.assert_memo_notice_source(p_context jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match_id uuid; grant_id uuid; BEGIN
 IF p_context->>'kind' IS DISTINCT FROM 'memo_available' THEN RETURN; END IF;
 v_match_id:=(p_context->>'matchId')::uuid; grant_id:=nullif(p_context->>'grantEvidenceId','')::uuid;
 PERFORM 1 FROM public.opportunities WHERE id=(p_context->>'opportunityId')::uuid FOR UPDATE NOWAIT;
 PERFORM 1 FROM public.opportunity_matches WHERE id=v_match_id FOR UPDATE NOWAIT;
 IF grant_id IS NULL THEN
 IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants g JOIN public.opportunity_matches m ON m.id=g.match_id
 WHERE g.match_id=v_match_id AND m.opportunity_id::text=p_context->>'opportunityId' AND g.grant_evidence_id IS NULL AND public.journey_repreneur_can_access_confidential(m.id,m.repreneur_id,g.information_memo_document_id))
 THEN RAISE EXCEPTION 'memo_notice_source_stale'; END IF;
 ELSE
 IF NOT public.journey_memo_grant_is_current(grant_id) OR NOT EXISTS(SELECT 1 FROM public.opportunity_memo_grant_snapshots s JOIN public.opportunity_memo_grant_notices n USING(grant_evidence_id)
 WHERE s.grant_evidence_id=grant_id AND s.match_id=v_match_id AND s.opportunity_id::text=p_context->>'opportunityId' AND n.state NOT IN ('external','sent','uncertain'))
 THEN RAISE EXCEPTION 'memo_notice_source_stale'; END IF;
 END IF;
END $$;
DO $$ DECLARE signature text; definition text; insertion text; BEGIN
 FOR signature,insertion IN SELECT * FROM (VALUES
 ('public.email_business_prepare(text,text,uuid,text,text,text,text,jsonb,jsonb)', 'PERFORM public.assert_memo_notice_source(p_context);'),
 ('public.email_business_reserve(uuid,integer,text)', 'SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id; PERFORM public.assert_memo_notice_source(r.source_context);'),
 ('public.email_business_authorize_attempt(uuid,uuid)', 'SELECT * INTO r FROM public.staff_email_reviews WHERE id=p_review_id; PERFORM public.assert_memo_notice_source(r.source_context);')
 ) changes(signature,insertion) LOOP
 definition:=pg_get_functiondef(signature::regprocedure);
 IF position('BEGIN' in definition)=0 THEN RAISE EXCEPTION 'memo_notice_policy_definition_drift'; END IF;
 EXECUTE regexp_replace(definition,'BEGIN','BEGIN '||insertion);
 END LOOP;
END $$;
-- The individual action used to mutate prepared_policy before reserving. This
-- exact business/manual seam checks the source first and commits marking and
-- reservation together, so either failure leaves no false Sending lease.
CREATE FUNCTION public.email_business_reserve_manual(p_review_id uuid,p_version integer,p_actor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE review public.staff_email_reviews%ROWTYPE; BEGIN
 SELECT * INTO review FROM public.staff_email_reviews WHERE id=p_review_id;
 PERFORM public.assert_memo_notice_source(review.source_context);
 PERFORM 1 FROM public.staff_email_reviews WHERE id=p_review_id FOR UPDATE;
 PERFORM public.email_review_mark_manual(p_review_id,p_version,p_actor);
 RETURN public.email_business_reserve(p_review_id,p_version,p_actor);
END $$;
-- Internal predecessor wrappers are never an alternate service entry point.
REVOKE ALL ON FUNCTION public.journey_grant_confidential_access_pre255(uuid,uuid,text,text,timestamptz),public.claim_opportunity_memo_notification_pre255(uuid,uuid,timestamptz),public.journey_repreneur_can_access_confidential_pre255(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY[
 'journey_repreneur_can_access_confidential(uuid,uuid,uuid)','journey_external_memo_context(uuid,uuid,timestamptz)','journey_grant_confidential_access(uuid,uuid,text,text,timestamptz)',
 'journey_grant_confidential_access_v2(uuid,uuid,text,text,timestamptz)','journey_memo_grant_is_current(uuid)',
 'journey_approve_memo_external_notice(uuid,jsonb,text,uuid,date,time,text,text,text,text,uuid,uuid)',
 'claim_opportunity_memo_notification(uuid,uuid,timestamptz)','claim_opportunity_memo_grant_notice(uuid,uuid,uuid,timestamptz)',
 'email_business_reserve_manual(uuid,integer,text)','finish_opportunity_memo_grant_notice(uuid,uuid,text,text,timestamptz,text)','authorize_opportunity_memo_grant_attempt(uuid,uuid)','assert_memo_notice_source(jsonb)'] LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO service_role';
 END LOOP;
END $$;
COMMIT;
