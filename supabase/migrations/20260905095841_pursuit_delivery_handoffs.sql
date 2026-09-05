-- #112: event-keyed handoffs. No historical send, backfill or visibility change.
CREATE TABLE public.opportunity_pursuit_handoff_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  upstream_evidence_id UUID NOT NULL REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  handoff_type TEXT NOT NULL CHECK (handoff_type IN ('e4','e6','e7')),
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  operation_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ma_interaction_id UUID UNIQUE REFERENCES public.ma_interactions(id) ON DELETE RESTRICT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sending','sent','failed')),
  provider_message_id TEXT,
  delivery_error TEXT,
  created_by TEXT NOT NULL CHECK (NULLIF(BTRIM(created_by),'') IS NOT NULL),
  last_attempted_by TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  attempt_started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  sent_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  evidence_id UUID UNIQUE REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  attachment_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachment_snapshot) = 'array'),
  prior_attempts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(prior_attempts) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(upstream_evidence_id,handoff_type),
  CHECK ((delivery_status = 'sent') = (sent_at IS NOT NULL AND evidence_id IS NOT NULL)),
  CHECK ((delivery_status = 'sending') = (finalized_at IS NULL)),
  CHECK (delivery_status <> 'failed' OR NULLIF(BTRIM(delivery_error),'') IS NOT NULL)
);
ALTER TABLE public.opportunity_pursuit_handoff_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_handoff_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pursuit_handoff_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_pursuit_handoff_deliveries TO service_role;

-- The generic historical evidence RPC cannot fabricate a new delivered handoff
-- or memo approval. These events are appended only inside the guarded finalizers.
CREATE FUNCTION public.guard_pursuit_handoff_evidence() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.event_type IN ('e4_qualification_requested','e6_nda_ready_notified','e7_signed_copies_and_memo_requested')
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries d WHERE d.id::TEXT=NEW.metadata->>'handoff_delivery_id' AND current_setting('wave.handoff_finalizing',true)=d.id::TEXT AND d.match_id=NEW.match_id AND d.upstream_evidence_id::TEXT=NEW.metadata->>'upstream_evidence_id' AND d.operation_key::TEXT=NEW.metadata->>'operation_key')
  THEN RAISE EXCEPTION 'Handoff evidence requires its delivery finalizer.'; END IF;
  IF NEW.event_type IN ('memo_approved','e8_memo_enabled_completed')
    AND current_setting('wave.memo_approval_finalizing',true) IS DISTINCT FROM NEW.match_id::TEXT
  THEN RAISE EXCEPTION 'Memo completion requires its staff approval transaction.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_pursuit_handoff_evidence BEFORE INSERT ON public.opportunity_pursuit_evidence FOR EACH ROW EXECUTE FUNCTION public.guard_pursuit_handoff_evidence();
REVOKE ALL ON FUNCTION public.guard_pursuit_handoff_evidence() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.journey_handoff_delivery_event_type(p_handoff TEXT)
RETURNS public.opportunity_pursuit_evidence_type LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE p_handoff
    WHEN 'e4' THEN 'e4_qualification_requested'::public.opportunity_pursuit_evidence_type
    WHEN 'e6' THEN 'e6_nda_ready_notified'::public.opportunity_pursuit_evidence_type
    WHEN 'e7' THEN 'e7_signed_copies_and_memo_requested'::public.opportunity_pursuit_evidence_type
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.journey_begin_handoff_delivery(
  p_match_id UUID,p_upstream_evidence_id UUID,p_handoff_type TEXT,
  p_request_fingerprint TEXT,p_actor TEXT,p_attachment_snapshot JSONB DEFAULT '[]'::jsonb
) RETURNS TABLE(delivery_id UUID,operation_key UUID,delivery_status TEXT,evidence_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE;
  v_upstream public.opportunity_pursuit_evidence%ROWTYPE;
  v public.opportunity_pursuit_handoff_deliveries%ROWTYPE;
  v_current UUID; v_snapshot JSONB; v_operation UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  IF p_handoff_type IS NULL OR p_handoff_type NOT IN ('e4','e6','e7')
    OR p_request_fingerprint IS NULL OR p_request_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_attachment_snapshot IS NULL OR jsonb_typeof(p_attachment_snapshot)<>'array'
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'Handoff requires a valid request and exact staff actor.'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit'
    OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active')
  THEN RAISE EXCEPTION 'Handoff requires an active pursuit in its current namespace.'; END IF;
  SELECT * INTO v_upstream FROM public.opportunity_pursuit_evidence WHERE id=p_upstream_evidence_id AND match_id=p_match_id;
  v_current:=CASE p_handoff_type WHEN 'e4' THEN public.journey_current_cycle_event(p_match_id) WHEN 'e6' THEN public.journey_current_gate_1_event(p_match_id) ELSE public.journey_current_gate_2_event(p_match_id) END;
  IF v_upstream.id IS NULL OR v_upstream.id IS DISTINCT FROM v_current THEN RAISE EXCEPTION 'Handoff requires exact current upstream evidence.'; END IF;
  IF p_handoff_type='e7' THEN
    SELECT jsonb_agg(jsonb_build_object('artifact_id',a.id,'document_id',d.id,'content_sha256',a.content_sha256,'file_name',d.file_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes) ORDER BY expected.ordinal)
    INTO v_snapshot
    FROM (VALUES (1,'renew_signed_copy',v_upstream.metadata->>'renew_artifact_id'),(2,'repreneur_signed_copy',v_upstream.metadata->>'repreneur_artifact_id')) AS expected(ordinal,role,id)
    JOIN public.opportunity_nda_artifacts a ON a.id::TEXT=expected.id AND a.artifact_role::TEXT=expected.role AND a.match_id=p_match_id AND a.opportunity_id=v_match.opportunity_id
    JOIN public.opportunity_documents d ON d.id=a.document_id AND d.opportunity_id=v_match.opportunity_id
    WHERE d.document_type='nda' AND d.visibility='staff_only' AND d.external_url IS NULL
      AND d.storage_bucket='opportunity-documents'
      AND d.storage_path LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/'||expected.role||'/%'
      AND d.mime_type='application/pdf' AND LOWER(d.file_name) LIKE '%.pdf' AND d.size_bytes BETWEEN 1 AND 20971520;
    IF jsonb_array_length(COALESCE(v_snapshot,'[]'::JSONB))<>2 OR v_snapshot IS DISTINCT FROM p_attachment_snapshot THEN RAISE EXCEPTION 'E7 requires the exact current private Gate 2 signed copies.'; END IF;
  ELSIF p_attachment_snapshot<>'[]'::JSONB THEN RAISE EXCEPTION 'Only E7 may attach signed copies.'; END IF;
  SELECT * INTO v FROM public.opportunity_pursuit_handoff_deliveries WHERE upstream_evidence_id=p_upstream_evidence_id AND handoff_type=p_handoff_type FOR UPDATE;
  IF v.id IS NOT NULL THEN
    IF v.delivery_status='sent' THEN RETURN QUERY SELECT v.id,v.operation_key,'sent'::TEXT,v.evidence_id; RETURN; END IF;
    IF v.delivery_status='sending' THEN
      IF v.request_fingerprint IS DISTINCT FROM p_request_fingerprint OR v.attachment_snapshot IS DISTINCT FROM p_attachment_snapshot THEN RAISE EXCEPTION 'An uncertain handoff must retry the exact original request.'; END IF;
      IF v.attempt_started_at <= clock_timestamp()-INTERVAL '23 hours' THEN RAISE EXCEPTION 'Handoff replay window expired; reconcile manually.'; END IF;
      IF v.last_attempt_at > clock_timestamp()-INTERVAL '2 minutes' THEN RETURN QUERY SELECT v.id,v.operation_key,'in_flight'::TEXT,NULL::UUID; RETURN; END IF;
      UPDATE public.opportunity_pursuit_handoff_deliveries SET attempt_count=attempt_count+1,last_attempt_at=clock_timestamp(),last_attempted_by=p_actor WHERE id=v.id;
      RETURN QUERY SELECT v.id,v.operation_key,'sending'::TEXT,NULL::UUID; RETURN;
    END IF;
    -- Only a conclusive recorded rejection permits a new provider operation.
    -- MA failures were bound to their exact canonical interaction at finalization.
    v_operation:=gen_random_uuid();
    UPDATE public.opportunity_pursuit_handoff_deliveries SET
      prior_attempts=prior_attempts||jsonb_build_array(jsonb_build_object('operation_key',v.operation_key,'ma_interaction_id',v.ma_interaction_id,'request_fingerprint',v.request_fingerprint,'attachment_snapshot',v.attachment_snapshot,'status',v.delivery_status,'error',v.delivery_error,'started_at',v.attempt_started_at,'finalized_at',v.finalized_at,'actor',v.last_attempted_by)),
      operation_key=v_operation,request_fingerprint=p_request_fingerprint,attachment_snapshot=p_attachment_snapshot,
      delivery_status='sending',ma_interaction_id=NULL,delivery_error=NULL,provider_message_id=NULL,
      attempt_count=attempt_count+1,attempt_started_at=clock_timestamp(),last_attempt_at=clock_timestamp(),last_attempted_by=p_actor,finalized_at=NULL
    WHERE id=v.id;
    RETURN QUERY SELECT v.id,v_operation,'sending'::TEXT,NULL::UUID; RETURN;
  END IF;
  INSERT INTO public.opportunity_pursuit_handoff_deliveries AS d(match_id,upstream_evidence_id,handoff_type,request_fingerprint,delivery_status,attachment_snapshot,created_by,last_attempted_by)
  VALUES(p_match_id,p_upstream_evidence_id,p_handoff_type,p_request_fingerprint,'sending',p_attachment_snapshot,p_actor,p_actor)
  RETURNING d.id,d.operation_key,d.delivery_status,d.evidence_id INTO delivery_id,operation_key,delivery_status,evidence_id;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.journey_finalize_handoff_delivery(
  p_delivery_id UUID,p_operation_key UUID,p_actor TEXT,p_delivery_status TEXT,
  p_provider_message_id TEXT DEFAULT NULL,p_delivery_error TEXT DEFAULT NULL,p_ma_interaction_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.opportunity_pursuit_handoff_deliveries%ROWTYPE; v_event UUID; v_interaction public.ma_interactions%ROWTYPE;
BEGIN
  IF p_delivery_status IS NULL OR p_delivery_status NOT IN ('sent','failed')
    OR (p_delivery_status='failed' AND (NULLIF(BTRIM(p_delivery_error),'') IS NULL OR LENGTH(p_delivery_error)>240))
    OR (p_delivery_status='sent' AND NULLIF(BTRIM(p_provider_message_id),'') IS NULL)
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'Handoff finalization requires exact staff and bounded delivery evidence.'; END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=(SELECT match_id FROM public.opportunity_pursuit_handoff_deliveries WHERE id=p_delivery_id) FOR UPDATE;
  SELECT * INTO v FROM public.opportunity_pursuit_handoff_deliveries WHERE id=p_delivery_id FOR UPDATE;
  IF v.id IS NULL OR v.operation_key IS DISTINCT FROM p_operation_key THEN RAISE EXCEPTION 'Unknown or superseded handoff attempt.'; END IF;
  IF v.handoff_type IN ('e4','e7') THEN
    SELECT * INTO v_interaction FROM public.ma_interactions WHERE id=p_ma_interaction_id FOR KEY SHARE;
    IF v_interaction.id IS NULL OR v_interaction.delivery_status IS DISTINCT FROM p_delivery_status
      OR v_interaction.opportunity_id IS DISTINCT FROM (SELECT opportunity_id FROM public.opportunity_matches WHERE id=v.match_id)
      OR v_interaction.client_operation_key IS DISTINCT FROM v.operation_key
      OR v_interaction.provider_request_fingerprint IS DISTINCT FROM v.request_fingerprint
      OR (p_delivery_status='sent' AND v_interaction.provider_message_id IS DISTINCT FROM p_provider_message_id)
    THEN RAISE EXCEPTION 'E4 and E7 require their exact canonical M&A delivery outcome.'; END IF;
  ELSIF p_ma_interaction_id IS NOT NULL THEN RAISE EXCEPTION 'Only E4 and E7 bind an M&A interaction.'; END IF;
  IF v.delivery_status='sent' THEN RETURN v.evidence_id; END IF;
  IF v.delivery_status='failed' AND p_delivery_status='failed' THEN RETURN NULL; END IF;
  IF v.delivery_status<>'sending' THEN RAISE EXCEPTION 'Handoff is not pending finalization.'; END IF;
  IF p_delivery_status='sent' THEN
    -- A receipt remains truthful history if its gate changed during provider I/O.
    -- Current-cycle/gate lookups alone decide whether it can advance the pursuit.
    PERFORM set_config('wave.handoff_finalizing',v.id::TEXT,true);
    v_event:=public.journey_append_evidence(v.match_id,public.journey_handoff_delivery_event_type(v.handoff_type),p_actor,v.handoff_type||':'||v.upstream_evidence_id::TEXT,NULL,NULL,NULL,
      jsonb_build_object('upstream_evidence_id',v.upstream_evidence_id,'handoff_delivery_id',v.id,'operation_key',v.operation_key,'initiated_by',v.created_by,'provider_message_id',p_provider_message_id,'ma_interaction_id',p_ma_interaction_id,'attachment_snapshot',v.attachment_snapshot));
    PERFORM set_config('wave.handoff_finalizing','',true);
  END IF;
  UPDATE public.opportunity_pursuit_handoff_deliveries SET delivery_status=p_delivery_status,ma_interaction_id=p_ma_interaction_id,provider_message_id=p_provider_message_id,delivery_error=p_delivery_error,last_attempted_by=p_actor,
    sent_at=CASE WHEN p_delivery_status='sent' THEN clock_timestamp() ELSE NULL END,finalized_at=clock_timestamp(),evidence_id=v_event WHERE id=v.id;
  RETURN v_event;
END $$;
REVOKE ALL ON FUNCTION public.journey_handoff_delivery_event_type(TEXT),public.journey_begin_handoff_delivery(UUID,UUID,TEXT,TEXT,TEXT,JSONB),public.journey_finalize_handoff_delivery(UUID,UUID,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_begin_handoff_delivery(UUID,UUID,TEXT,TEXT,TEXT,JSONB),public.journey_finalize_handoff_delivery(UUID,UUID,TEXT,TEXT,TEXT,TEXT,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.journey_grant_confidential_access(
  p_match_id UUID,p_information_memo_document_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_nda_expires_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE; v_doc public.opportunity_documents%ROWTYPE;
  v_existing UUID; v_cycle UUID; v_gate2 UUID; v_e7 UUID; v_firm_id UUID;
  v_firm_name TEXT; v_office_id UUID; v_office_name TEXT; v_contacts JSONB; v_event UUID;
  v_grant public.opportunity_pursuit_confidential_grants%ROWTYPE; v_approval UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  IF (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN RAISE EXCEPTION 'Memo approval requires exact staff authority.'; END IF;
  IF p_nda_expires_at IS NULL OR p_nda_expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'A future NDA expiry is required before confidential access.'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE id=v_existing AND event_type='confidential_access_granted' AND document_id=p_information_memo_document_id AND (metadata->>'nda_expires_at')::TIMESTAMPTZ=p_nda_expires_at) THEN RAISE EXCEPTION 'Grant retry must match its original approval.'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.opportunity_matches m WHERE m.id=p_match_id AND public.journey_repreneur_can_access_confidential(m.id,m.repreneur_id,p_information_memo_document_id)) THEN RAISE EXCEPTION 'The prior grant is no longer current. Review the pursuit before a new approval.'; END IF;
    RETURN v_existing;
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR v_match.status<>'active_pursuit' OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active') THEN RAISE EXCEPTION 'An active pursuit on an active opportunity is required.'; END IF;
  SELECT * INTO v_doc FROM public.opportunity_documents WHERE id=p_information_memo_document_id;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_gate2:=public.journey_current_gate_2_event(p_match_id); SELECT id INTO v_e7 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='e7_signed_copies_and_memo_requested' AND metadata->>'upstream_evidence_id'=v_gate2::TEXT ORDER BY recorded_at DESC,id DESC LIMIT 1;
  IF v_cycle IS NULL OR v_gate2 IS NULL OR v_e7 IS NULL THEN RAISE EXCEPTION 'Current Gate 2 and its sent E7 handoff are required before confidential access.'; END IF;
  IF v_doc.id IS NULL
    OR v_doc.opportunity_id<>v_match.opportunity_id
    OR v_doc.document_type<>'deal_book'
    OR v_doc.visibility<>'staff_only'
    OR v_doc.external_url IS NOT NULL
    OR COALESCE(v_doc.storage_bucket,'opportunity-documents')<>'opportunity-documents'
    OR NULLIF(BTRIM(v_doc.storage_path),'') IS NULL
    OR v_doc.storage_path NOT LIKE v_match.opportunity_id::TEXT||'/%'
    OR LOWER(COALESCE(v_doc.file_name,'')) NOT LIKE '%.pdf'
  THEN RAISE EXCEPTION 'Select a retained staff-only PDF Information Memorandum for this opportunity.'; END IF;
  SELECT f.id,f.name,o.id,o.name INTO v_firm_id,v_firm_name,v_office_id,v_office_name FROM public.opportunities p JOIN public.ma_offices o ON o.id=p.source_office_id JOIN public.ma_firms f ON f.id=o.firm_id WHERE p.id=v_match.opportunity_id AND o.status='active' AND f.status<>'archived';
  IF v_office_id IS NULL THEN RAISE EXCEPTION 'An active canonical source office is required before disclosure.'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name',link.contact_name_snapshot) ORDER BY link.is_primary DESC,link.linked_at),'[]'::JSONB) INTO v_contacts FROM public.opportunity_ma_contacts link JOIN public.ma_contact_office_affiliations a ON a.id=link.affiliation_id WHERE link.opportunity_id=v_match.opportunity_id AND link.is_active AND a.office_id=v_office_id AND NULLIF(BTRIM(link.contact_name_snapshot),'') IS NOT NULL;
  IF jsonb_array_length(v_contacts)=0 THEN RAISE EXCEPTION 'An approved source contact is required before disclosure.'; END IF;
  SELECT * INTO v_grant FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id FOR UPDATE;
  IF v_grant.id IS NOT NULL AND v_grant.revoked_at IS NULL
    AND v_grant.cycle_started_evidence_id=v_cycle AND v_grant.gate_2_evidence_id=v_gate2 AND v_grant.dispatch_evidence_id=v_e7 THEN
    IF v_grant.information_memo_document_id=p_information_memo_document_id AND v_grant.nda_expires_at=p_nda_expires_at THEN
      SELECT id INTO v_event FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='confidential_access_granted' AND metadata->>'cycle_started_evidence_id'=v_cycle::TEXT AND metadata->>'gate_2_evidence_id'=v_gate2::TEXT AND metadata->>'dispatch_evidence_id'=v_e7::TEXT ORDER BY recorded_at DESC,id DESC LIMIT 1;
      IF v_event IS NULL THEN RAISE EXCEPTION 'Live grant lacks its immutable disclosure evidence.'; END IF;
      RETURN v_event;
    END IF;
    RAISE EXCEPTION 'Confidential access is already live for this pursuit. Revoke it before changing the disclosure.';
  END IF;
  PERFORM set_config('wave.memo_approval_finalizing',p_match_id::TEXT,true);
  v_approval:=public.journey_append_evidence(p_match_id,'memo_approved',p_actor,'memo:'||p_idempotency_key,NULL,v_doc.id,NULL,jsonb_build_object('cycle_started_evidence_id',v_cycle,'gate_2_evidence_id',v_gate2,'e7_evidence_id',v_e7,'information_memo_document_id',v_doc.id,'approval_scope','exact_pursuit','memo_approved_by',p_actor));
  INSERT INTO public.opportunity_pursuit_confidential_grants(match_id,opportunity_id,information_memo_document_id,source_firm_id,source_firm_name,source_office_id,source_office_name,disclosed_contacts,granted_by,cycle_started_evidence_id,gate_2_evidence_id,dispatch_evidence_id,nda_expires_at)
  VALUES(v_match.id,v_match.opportunity_id,v_doc.id,v_firm_id,v_firm_name,v_office_id,v_office_name,v_contacts,p_actor,v_cycle,v_gate2,v_e7,p_nda_expires_at)
  ON CONFLICT(match_id) DO UPDATE SET information_memo_document_id=EXCLUDED.information_memo_document_id,source_firm_id=EXCLUDED.source_firm_id,source_firm_name=EXCLUDED.source_firm_name,source_office_id=EXCLUDED.source_office_id,source_office_name=EXCLUDED.source_office_name,disclosed_contacts=EXCLUDED.disclosed_contacts,source_disclosed_at=clock_timestamp(),granted_by=EXCLUDED.granted_by,cycle_started_evidence_id=EXCLUDED.cycle_started_evidence_id,gate_2_evidence_id=EXCLUDED.gate_2_evidence_id,dispatch_evidence_id=EXCLUDED.dispatch_evidence_id,nda_expires_at=EXCLUDED.nda_expires_at,revoked_at=NULL,revoked_by=NULL,revoked_reason=NULL;
  v_event:=public.journey_append_evidence(p_match_id,'confidential_access_granted',p_actor,p_idempotency_key,NULL,v_doc.id,NULL,jsonb_build_object('cycle_started_evidence_id',v_cycle,'gate_2_evidence_id',v_gate2,'dispatch_evidence_id',v_e7,'information_memo_document_id',v_doc.id,'source_firm_name',v_firm_name,'source_office_name',v_office_name,'contact_names',v_contacts,'nda_expires_at',p_nda_expires_at,'memo_approval_evidence_id',v_approval));
  PERFORM public.journey_append_evidence(p_match_id,'e8_memo_enabled_completed',p_actor,'e8:'||v_cycle::TEXT||':'||v_gate2::TEXT||':'||v_doc.id::TEXT,NULL,v_doc.id,NULL,jsonb_build_object('grant_evidence_id',v_event,'memo_approval_evidence_id',v_approval,'gate_2_evidence_id',v_gate2,'e7_evidence_id',v_e7,'information_memo_document_id',v_doc.id));
  PERFORM set_config('wave.memo_approval_finalizing','',true);
  RETURN v_event;
END $$;

-- Freeze the E4 blank-NDA predicate at the validation event. A delayed send or
-- retry must never acquire a later-uploaded artifact as though it existed then.
CREATE OR REPLACE FUNCTION public.journey_start_pursuit(
  p_match_id UUID,p_actor TEXT,p_idempotency_key TEXT,p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_existing UUID; v_blank_present BOOLEAN; v_previous public.opportunity_pursuit_evidence%ROWTYPE; v_revalidate BOOLEAN:=false;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.id IS NULL OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR (SELECT count(*) FROM public.app_user_roles WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1
  THEN RAISE EXCEPTION 'Mutual-interest validation requires exact staff and a same-namespace match.'; END IF;
  IF v_match.status='active_pursuit' THEN
    SELECT * INTO v_previous FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_cycle_event(p_match_id);
    IF v_previous.id IS NULL OR jsonb_typeof(v_previous.metadata->'blank_nda_present_at_validation')='boolean'
      OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants WHERE match_id=p_match_id AND revoked_at IS NULL)
    THEN RAISE EXCEPTION 'Only a historical pursuit without frozen validation or live access may be revalidated.'; END IF;
    v_revalidate:=true;
  ELSIF v_match.status<>'interested' THEN RAISE EXCEPTION 'Only an interested match can start a pursuit.'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active opportunity can start a pursuit.'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts a JOIN public.opportunity_documents d ON d.id=a.document_id WHERE a.opportunity_id=v_match.opportunity_id AND a.match_id IS NULL AND a.artifact_role='blank_template' AND d.document_type='nda' AND d.visibility='staff_only' AND d.external_url IS NULL AND d.storage_bucket='opportunity-documents' AND d.storage_path LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%' AND d.size_bytes>0 AND ((d.mime_type='application/pdf' AND LOWER(d.file_name) LIKE '%.pdf') OR (d.mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document' AND LOWER(d.file_name) LIKE '%.docx'))) INTO v_blank_present;
  IF NOT v_revalidate THEN
    UPDATE public.opportunity_matches SET status='active_pursuit',pursuit_stage='interest',pursuit_stage_updated_by=p_actor,pursuit_stage_updated_at=NOW(),reviewed_by=p_actor,reviewed_at=NOW() WHERE id=p_match_id;
  END IF;
  RETURN public.journey_append_evidence(p_match_id,'mutual_interest_validated',p_actor,p_idempotency_key,NULL,NULL,p_evidence_reference,jsonb_build_object('blank_nda_present_at_validation',v_blank_present,'previous_validation_evidence_id',v_previous.id,'historical_revalidation',v_revalidate));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This opportunity already has an active pursuit.'; END $$;

-- Qualification cannot advance until the explicit E4 delivery has succeeded;
-- Gate 1 likewise cannot advance until E6 is durably delivered. E7 replaces
-- the former manual-dispatch prerequisite for the memo grant above.
CREATE OR REPLACE FUNCTION public.journey_record_evidence(
  p_match_id UUID,p_event_type TEXT,p_actor TEXT,p_idempotency_key TEXT,
  p_artifact_id UUID DEFAULT NULL,p_document_id UUID DEFAULT NULL,p_evidence_reference TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_type public.opportunity_pursuit_evidence_type:=p_event_type::public.opportunity_pursuit_evidence_type; v_match public.opportunity_matches%ROWTYPE; v_cycle UUID; v_start TIMESTAMPTZ; v_template UUID; v_artifact public.opportunity_nda_artifacts%ROWTYPE; v_gate1 UUID; v_renew_validation UUID; v_repreneur_validation UUID; v_existing UUID; v_metadata JSONB:='{}'::JSONB;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT id INTO v_existing FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND idempotency_key=p_idempotency_key; IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE; IF v_match.id IS NULL OR v_match.status<>'active_pursuit' THEN RAISE EXCEPTION 'An active pursuit is required.'; END IF;
  v_cycle:=public.journey_current_cycle_event(p_match_id); v_start:=public.journey_current_cycle_started_at(p_match_id); IF v_cycle IS NULL THEN RAISE EXCEPTION 'Recorded mutual interest is required.'; END IF;
  IF v_type='intermediary_qualified' THEN IF NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='e4_qualification_requested' AND metadata->>'upstream_evidence_id'=v_cycle::TEXT) THEN RAISE EXCEPTION 'Intermediary qualification requires sent E4 for this validation.'; END IF;
  ELSIF v_type='template_validated' THEN v_template:=public.journey_current_template_id(p_match_id); IF p_artifact_id IS NULL OR v_template IS NULL OR p_artifact_id IS DISTINCT FROM v_template OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='intermediary_qualified' AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Template validation requires current-cycle qualification and the exact current blank template.'; END IF;
  ELSIF v_type='gate_1_passed' THEN v_template:=public.journey_current_template_id(p_match_id); IF v_template IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='template_validated' AND nda_artifact_id=v_template AND recorded_at>=v_start) THEN RAISE EXCEPTION 'Gate 1 requires this cycle qualification and exact current-template validation.'; END IF;
  ELSIF v_type IN ('renew_signed_copy_validated','repreneur_signed_copy_validated') THEN v_gate1:=public.journey_current_gate_1_event(p_match_id); SELECT * INTO v_artifact FROM public.opportunity_nda_artifacts WHERE id=p_artifact_id; IF v_gate1 IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='e6_nda_ready_notified' AND metadata->>'upstream_evidence_id'=v_gate1::TEXT) OR v_artifact.id IS NULL OR v_artifact.match_id<>p_match_id OR v_artifact.artifact_role<>(CASE WHEN v_type='renew_signed_copy_validated' THEN 'renew_signed_copy'::public.opportunity_nda_artifact_role ELSE 'repreneur_signed_copy'::public.opportunity_nda_artifact_role END) OR EXISTS(SELECT 1 FROM public.opportunity_nda_artifacts n WHERE n.match_id=p_match_id AND n.artifact_role=v_artifact.artifact_role AND n.version_number>v_artifact.version_number) OR v_artifact.recorded_at<(SELECT recorded_at FROM public.opportunity_pursuit_evidence WHERE id=v_gate1) THEN RAISE EXCEPTION 'Signed-copy validation requires sent E6 and the exact current copy after Gate 1.'; END IF;
  ELSIF v_type='gate_2_passed' THEN v_renew_validation:=public.journey_current_signed_validation_event(p_match_id,'renew_signed_copy'); v_repreneur_validation:=public.journey_current_signed_validation_event(p_match_id,'repreneur_signed_copy'); IF v_renew_validation IS NULL OR v_repreneur_validation IS NULL THEN RAISE EXCEPTION 'Gate 2 requires current signed copies validated after Gate 1.'; END IF; v_metadata:=jsonb_build_object('renew_validation_id',v_renew_validation,'repreneur_validation_id',v_repreneur_validation,'renew_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_renew_validation),'repreneur_artifact_id',(SELECT nda_artifact_id FROM public.opportunity_pursuit_evidence WHERE id=v_repreneur_validation));
  ELSE RAISE EXCEPTION 'This evidence type is not a staff journey action.'; END IF;
  RETURN public.journey_append_evidence(p_match_id,v_type,p_actor,p_idempotency_key,p_artifact_id,p_document_id,p_evidence_reference,v_metadata);
END $$;

-- E7 is the only accepted memo-request handoff for current Gate 2. Historical
-- manual dispatch rows remain readable evidence but cannot satisfy a new grant.
CREATE OR REPLACE FUNCTION public.journey_current_dispatch_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH gate AS (SELECT id, recorded_at, metadata FROM public.opportunity_pursuit_evidence WHERE id=public.journey_current_gate_2_event(p_match_id))
  SELECT e.id FROM public.opportunity_pursuit_evidence e, gate g
  WHERE e.match_id=p_match_id AND e.event_type='e7_signed_copies_and_memo_requested'
    AND e.recorded_at>=g.recorded_at AND e.metadata->>'upstream_evidence_id'=g.id::TEXT
  ORDER BY e.recorded_at DESC,e.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.journey_current_dispatch_event(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_current_dispatch_event(UUID) TO service_role;

-- E6 is an authority gate, including duplicate-content reuse.
CREATE OR REPLACE FUNCTION public.journey_submit_repreneur_signed_copy(
  p_match_id UUID,p_repreneur_id UUID,p_actor_email TEXT,p_title TEXT,p_storage_path TEXT,
  p_file_name TEXT,p_file_size BIGINT,p_content_sha256 TEXT
)
RETURNS TABLE(artifact_id UUID,document_id UUID,version_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_email TEXT; v_gate UUID; v_prior UUID; v_version INTEGER; v_document UUID; v_artifact UUID;
BEGIN
  IF NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'wave_journey_disabled'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT LOWER(BTRIM(email)) INTO v_email FROM public.repreneurs WHERE id=p_repreneur_id;
  IF v_match.id IS NULL OR NOT public.w164_match_has_same_namespace(v_match.id)
    OR v_match.status<>'active_pursuit' OR v_match.repreneur_id<>p_repreneur_id
    OR v_email IS NULL OR v_email<>LOWER(BTRIM(p_actor_email))
    OR NOT EXISTS(SELECT 1 FROM public.opportunities WHERE id=v_match.opportunity_id AND status='active')
  THEN RAISE EXCEPTION 'Only the active pursuit repreneur may submit this signed copy.'; END IF;
  v_gate:=public.journey_current_gate_1_event(p_match_id);
  IF v_gate IS NULL OR NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id=p_match_id AND event_type='e6_nda_ready_notified' AND metadata->>'upstream_evidence_id'=v_gate::TEXT) THEN RAISE EXCEPTION 'Current Gate 1 and its sent E6 notice are required before signed-copy submission.'; END IF;
  IF NULLIF(BTRIM(p_title),'') IS NULL OR NULLIF(BTRIM(p_storage_path),'') IS NULL
    OR LOWER(p_file_name) NOT LIKE '%.pdf' OR p_file_size<=0 OR p_file_size>20971520
    OR LOWER(p_content_sha256)!~'^[0-9a-f]{64}$'
    OR p_storage_path NOT LIKE v_match.opportunity_id::TEXT||'/nda-artifacts/repreneur_signed_copy/%'
  THEN RAISE EXCEPTION 'Submit one retained PDF in the canonical signed-copy path.'; END IF;
  SELECT artifact.id,artifact.version_number INTO v_artifact,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NOT NULL THEN
    RETURN QUERY SELECT v_artifact,(SELECT artifact.document_id FROM public.opportunity_nda_artifacts artifact WHERE artifact.id=v_artifact),v_version; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_match_id::TEXT||':repreneur_signed_copy',0));
  SELECT artifact.id,artifact.document_id,artifact.version_number INTO v_artifact,v_document,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NOT NULL THEN RETURN QUERY SELECT v_artifact,v_document,v_version; RETURN; END IF;
  SELECT artifact.id,artifact.version_number+1 INTO v_prior,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
  ORDER BY artifact.version_number DESC LIMIT 1;
  v_version:=COALESCE(v_version,1);
  INSERT INTO public.opportunity_documents(opportunity_id,title,document_type,visibility,storage_bucket,storage_path,file_name,size_bytes,mime_type,uploaded_by)
  VALUES(v_match.opportunity_id,p_title,'nda','staff_only','opportunity-documents',p_storage_path,p_file_name,p_file_size,'application/pdf',p_actor_email)
  RETURNING id INTO v_document;
  PERFORM set_config('wave.journey_portal_repreneur_upload','on',true);
  INSERT INTO public.opportunity_nda_artifacts(opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,supersedes_artifact_id,recorded_by,recorded_at)
  VALUES(v_match.opportunity_id,p_match_id,v_document,'repreneur_signed_copy',v_version,LOWER(p_content_sha256),v_prior,p_actor_email,clock_timestamp())
  RETURNING id INTO v_artifact;
  RETURN QUERY SELECT v_artifact,v_document,v_version;
EXCEPTION WHEN unique_violation THEN
  SELECT artifact.id,artifact.document_id,artifact.version_number INTO v_artifact,v_document,v_version
  FROM public.opportunity_nda_artifacts artifact
  WHERE artifact.match_id=p_match_id AND artifact.artifact_role='repreneur_signed_copy'
    AND artifact.content_sha256=LOWER(p_content_sha256) LIMIT 1;
  IF v_artifact IS NULL THEN RAISE; END IF;
  RETURN QUERY SELECT v_artifact,v_document,v_version;
END
$$;
REVOKE ALL ON FUNCTION public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_submit_repreneur_signed_copy(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT,TEXT) TO service_role;

-- The portal can retrieve a template only after the distinct E6 notice.
CREATE OR REPLACE FUNCTION public.journey_repreneur_authorized_template(
  p_match_id UUID,p_repreneur_id UUID
)
RETURNS TABLE(document_id UUID,storage_bucket TEXT,storage_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT document.id,document.storage_bucket,document.storage_path
  FROM public.wave_journey_settings settings
  JOIN public.opportunity_matches match ON match.id=p_match_id
  JOIN public.repreneurs repreneur ON repreneur.id=match.repreneur_id
  JOIN public.opportunities opportunity ON opportunity.id=match.opportunity_id AND opportunity.is_demo=repreneur.is_demo
  JOIN public.opportunity_nda_artifacts artifact ON artifact.id=public.journey_current_template_id(match.id)
  JOIN public.opportunity_documents document ON document.id=artifact.document_id
  WHERE settings.singleton=TRUE AND settings.enabled=TRUE
    AND match.repreneur_id=p_repreneur_id AND match.status='active_pursuit' AND opportunity.status='active'
    AND public.journey_current_gate_1_event(match.id) IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.match_id=match.id AND e.event_type='e6_nda_ready_notified' AND e.metadata->>'upstream_evidence_id'=public.journey_current_gate_1_event(match.id)::TEXT)
    AND artifact.opportunity_id=match.opportunity_id AND artifact.match_id IS NULL AND artifact.artifact_role='blank_template'
    AND document.opportunity_id=match.opportunity_id AND document.document_type='nda' AND document.visibility='staff_only'
    AND document.external_url IS NULL AND document.storage_bucket='opportunity-documents'
    AND document.storage_path LIKE match.opportunity_id::TEXT||'/nda-artifacts/blank_template/%'
    AND ((LOWER(COALESCE(document.file_name,'')) LIKE '%.pdf' AND LOWER(COALESCE(document.mime_type,''))='application/pdf')
      OR (LOWER(COALESCE(document.file_name,'')) LIKE '%.docx'
        AND LOWER(COALESCE(document.mime_type,''))='application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    AND COALESCE(document.size_bytes,0)>0 LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.journey_repreneur_authorized_template(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_repreneur_authorized_template(UUID,UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.journey_current_gate_1_event(p_match_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH cycle AS (SELECT public.journey_current_cycle_event(p_match_id) id),
  start AS (SELECT e.recorded_at FROM public.opportunity_pursuit_evidence e JOIN cycle c ON c.id=e.id),
  template AS (SELECT public.journey_current_template_id(p_match_id) id),
  qualified AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, start s, cycle c
    WHERE e.match_id=p_match_id AND e.event_type='intermediary_qualified' AND e.recorded_at>=s.recorded_at
      AND EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e4 WHERE e4.match_id=p_match_id AND e4.event_type='e4_qualification_requested' AND e4.metadata->>'upstream_evidence_id'=c.id::TEXT AND e4.recorded_at<=e.recorded_at)
  ), template_validated AS (
    SELECT max(e.recorded_at) recorded_at FROM public.opportunity_pursuit_evidence e, template t, qualified q
    WHERE e.match_id=p_match_id AND e.event_type='template_validated' AND e.nda_artifact_id=t.id AND q.recorded_at IS NOT NULL AND e.recorded_at>=q.recorded_at
  )
  SELECT e.id FROM public.opportunity_pursuit_evidence e, cycle c, template_validated v
  WHERE c.id IS NOT NULL AND e.match_id=p_match_id AND e.event_type='gate_1_passed' AND v.recorded_at IS NOT NULL AND e.recorded_at>=v.recorded_at
  ORDER BY e.recorded_at DESC,e.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.journey_current_gate_1_event(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_current_gate_1_event(UUID) TO service_role;
