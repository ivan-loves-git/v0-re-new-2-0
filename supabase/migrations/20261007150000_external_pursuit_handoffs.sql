-- #248 / #254: completed external E4/E6/E7. Additive, no historical promotion,
-- email-provider receipt, access grant or document fabrication.
BEGIN;
CREATE TABLE public.pursuit_external_handoff_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT true
);
INSERT INTO public.pursuit_external_handoff_settings(singleton,enabled) VALUES(true,true);
ALTER TABLE public.pursuit_external_handoff_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuit_external_handoff_settings FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.pursuit_external_handoff_settings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.pursuit_external_handoff_settings TO service_role;

CREATE TABLE public.opportunity_pursuit_external_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL UNIQUE REFERENCES public.opportunity_pursuit_evidence(id) DEFERRABLE INITIALLY DEFERRED,
  match_id uuid NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE RESTRICT,
  repreneur_id uuid NOT NULL REFERENCES public.repreneurs(id) ON DELETE RESTRICT,
  upstream_evidence_id uuid NOT NULL REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  handoff_type text NOT NULL CHECK(handoff_type IN ('e4','e6','e7')),
  operation_key uuid NOT NULL UNIQUE,
  context jsonb NOT NULL CHECK(jsonb_typeof(context)='object'),
  exchange_date date NOT NULL,
  exchange_time time(0),
  exchange_timezone text NOT NULL DEFAULT 'Europe/Paris' CHECK(exchange_timezone='Europe/Paris'),
  channel text NOT NULL CHECK(channel IN ('email','phone','meeting','other')),
  reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 5 AND 500),
  staff_user_id text NOT NULL CHECK(nullif(btrim(staff_user_id),'') IS NOT NULL),
  staff_email text NOT NULL CHECK(nullif(btrim(staff_email),'') IS NOT NULL),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(upstream_evidence_id,handoff_type)
);
ALTER TABLE public.opportunity_pursuit_external_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_pursuit_external_handoffs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_pursuit_external_handoffs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.opportunity_pursuit_external_handoffs TO service_role;
CREATE FUNCTION public.reject_external_handoff_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'external_handoff_immutable'; END $$;
CREATE TRIGGER external_handoff_immutable BEFORE UPDATE OR DELETE ON public.opportunity_pursuit_external_handoffs
FOR EACH ROW EXECUTE FUNCTION public.reject_external_handoff_mutation();
CREATE TRIGGER external_handoff_no_truncate BEFORE TRUNCATE ON public.opportunity_pursuit_external_handoffs
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_external_handoff_mutation();
REVOKE ALL ON FUNCTION public.reject_external_handoff_mutation() FROM PUBLIC,anon,authenticated,service_role;

-- Only a linked, actual provider acceptance or the protected new receipt qualifies.
CREATE FUNCTION public.journey_handoff_is_qualifying(p_evidence_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.opportunity_pursuit_evidence e
    WHERE e.id=p_evidence_id AND e.event_type IN ('e4_qualification_requested','e6_nda_ready_notified','e7_signed_copies_and_memo_requested')
    AND (
      EXISTS(SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries d
        WHERE d.evidence_id=e.id AND d.match_id=e.match_id AND d.delivery_status='sent'
          AND e.event_type=public.journey_handoff_delivery_event_type(d.handoff_type)
          AND d.id::text=e.metadata->>'handoff_delivery_id' AND d.operation_key::text=e.metadata->>'operation_key'
          AND d.upstream_evidence_id::text=e.metadata->>'upstream_evidence_id'
          AND nullif(btrim(d.provider_message_id),'') IS NOT NULL AND d.provider_message_id=e.metadata->>'provider_message_id')
      OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs x
        WHERE x.evidence_id=e.id AND x.match_id=e.match_id AND x.opportunity_id=e.opportunity_id AND x.repreneur_id=e.repreneur_id
          AND x.id::text=e.metadata->>'external_handoff_id' AND e.metadata->>'qualifying_origin'='external_staff_v1'
          AND x.upstream_evidence_id::text=e.metadata->>'upstream_evidence_id'
          AND x.operation_key::text=e.metadata->>'operation_key' AND x.staff_user_id=e.actor
          AND x.context=e.metadata->'context')
    )
  )
$$;
REVOKE ALL ON FUNCTION public.journey_handoff_is_qualifying(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_handoff_is_qualifying(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_pursuit_handoff_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.event_type IN ('e4_qualification_requested','e6_nda_ready_notified','e7_signed_copies_and_memo_requested')
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries d WHERE d.id::text=NEW.metadata->>'handoff_delivery_id' AND current_setting('wave.handoff_finalizing',true)=d.id::text AND d.match_id=NEW.match_id AND d.upstream_evidence_id::text=NEW.metadata->>'upstream_evidence_id' AND d.operation_key::text=NEW.metadata->>'operation_key')
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs x
      WHERE x.id::text=current_setting('wave.external_handoff_finalizing',true) AND x.id::text=NEW.metadata->>'external_handoff_id'
        AND NEW.metadata->>'qualifying_origin'='external_staff_v1' AND x.evidence_id=NEW.id
        AND x.match_id=NEW.match_id AND x.opportunity_id=NEW.opportunity_id AND x.repreneur_id=NEW.repreneur_id
        AND NEW.event_type=public.journey_handoff_delivery_event_type(x.handoff_type)
        AND x.upstream_evidence_id::text=NEW.metadata->>'upstream_evidence_id' AND x.operation_key::text=NEW.metadata->>'operation_key'
        AND x.staff_user_id=NEW.actor AND x.reference=NEW.evidence_reference AND x.recorded_at=NEW.recorded_at
        AND x.context=NEW.metadata->'context' AND NEW.metadata->>'provider_message_id' IS NULL)
  THEN RAISE EXCEPTION 'Handoff evidence requires its protected finalizer.'; END IF;
  IF NEW.event_type IN ('memo_approved','e8_memo_enabled_completed')
    AND current_setting('wave.memo_approval_finalizing',true) IS DISTINCT FROM NEW.match_id::text
  THEN RAISE EXCEPTION 'Memo completion requires its staff approval transaction.'; END IF;
  RETURN NEW;
END $$;

-- One strictly phase-scoped canonical document snapshot, without MIME download
-- or email-recipient requirements. Called again under transaction-held locks.
CREATE FUNCTION public.journey_external_handoff_context(p_match_id uuid,p_handoff_type text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.opportunity_matches%ROWTYPE; o public.opportunities%ROWTYPE;
  cycle_event_id uuid; upstream_event_id uuid; template_id uuid; artifact_id uuid; g public.opportunity_pursuit_evidence%ROWTYPE;
  docs jsonb; expected_ids uuid[]; a public.opportunity_nda_artifacts%ROWTYPE;
  d public.opportunity_documents%ROWTYPE; blank boolean;
BEGIN
  SELECT * INTO m FROM public.opportunity_matches WHERE id=p_match_id;
  SELECT * INTO o FROM public.opportunities WHERE id=m.opportunity_id;
  IF NOT public.wave_journey_is_enabled() OR m.id IS NULL OR m.status<>'active_pursuit'
    OR o.status<>'active' OR NOT public.w164_match_has_same_namespace(m.id)
    OR p_handoff_type IS NULL OR p_handoff_type NOT IN ('e4','e6','e7')
  THEN RAISE EXCEPTION 'external_handoff_pursuit_stale'; END IF;
  IF p_handoff_type IN ('e4','e7') AND (o.source_office_id IS NULL OR public.ma_opportunity_source_review_required(o.id) IS DISTINCT FROM false
    OR NOT EXISTS(SELECT 1 FROM public.ma_offices office JOIN public.ma_firms firm ON firm.id=office.firm_id
      WHERE office.id=o.source_office_id AND office.status='active' AND firm.status='active'))
  THEN RAISE EXCEPTION 'external_handoff_source_not_ready'; END IF;
  cycle_event_id:=public.journey_current_cycle_event(m.id);
  upstream_event_id:=CASE p_handoff_type WHEN 'e4' THEN cycle_event_id WHEN 'e6' THEN public.journey_current_gate_1_event(m.id) ELSE public.journey_current_gate_2_event(m.id) END;
  IF cycle_event_id IS NULL OR upstream_event_id IS NULL THEN RAISE EXCEPTION 'external_handoff_approval_not_ready'; END IF;
  SELECT * INTO g FROM public.opportunity_pursuit_evidence WHERE id=upstream_event_id;
  template_id:=public.journey_current_template_id(m.id);
  IF p_handoff_type='e4' THEN
    IF jsonb_typeof(g.metadata->'blank_nda_present_at_validation') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'external_handoff_historical_validation'; END IF;
    blank:=(g.metadata->>'blank_nda_present_at_validation')::boolean;
    IF blank AND template_id IS NULL THEN RAISE EXCEPTION 'external_handoff_template_missing'; END IF;
    expected_ids:=CASE WHEN template_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[template_id] END;
  ELSIF p_handoff_type='e6' THEN
    IF template_id IS NULL THEN RAISE EXCEPTION 'external_handoff_template_missing'; END IF;
    expected_ids:=ARRAY[template_id];
  ELSE
    expected_ids:=ARRAY[(g.metadata->>'renew_artifact_id')::uuid,(g.metadata->>'repreneur_artifact_id')::uuid];
    IF expected_ids[1] IS NULL OR expected_ids[2] IS NULL OR expected_ids[1]=expected_ids[2] THEN RAISE EXCEPTION 'external_handoff_copies_missing'; END IF;
  END IF;
  docs:='[]'::jsonb;
  FOREACH artifact_id IN ARRAY expected_ids LOOP
    SELECT * INTO a FROM public.opportunity_nda_artifacts WHERE id=artifact_id;
    SELECT * INTO d FROM public.opportunity_documents WHERE id=a.document_id;
    IF a.id IS NULL OR d.id IS NULL OR a.opportunity_id<>o.id OR d.opportunity_id<>o.id
      OR d.document_type<>'nda' OR d.visibility<>'staff_only' OR d.external_url IS NOT NULL
      OR d.storage_bucket<>'opportunity-documents' OR a.content_sha256 !~ '^[0-9a-f]{64}$'
      OR d.storage_path IS NULL OR d.file_name IS NULL OR d.mime_type IS NULL
      OR d.storage_path NOT LIKE o.id::text||'/nda-artifacts/'||a.artifact_role::text||'/%'
      OR d.size_bytes IS NULL OR d.size_bytes NOT BETWEEN 1 AND 20971520
      OR (p_handoff_type='e7' AND (a.match_id IS DISTINCT FROM m.id OR a.artifact_role NOT IN ('renew_signed_copy','repreneur_signed_copy')))
      OR (p_handoff_type<>'e7' AND (a.match_id IS NOT NULL OR a.artifact_role<>'blank_template'))
      OR NOT ((d.mime_type='application/pdf' AND lower(d.file_name) LIKE '%.pdf')
        OR (a.artifact_role='blank_template' AND d.mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document' AND lower(d.file_name) LIKE '%.docx'))
    THEN RAISE EXCEPTION 'external_handoff_document_invalid'; END IF;
    docs:=docs||jsonb_build_array(jsonb_build_object('artifact_id',a.id,'document_id',d.id,'version',a.version_number,
      'role',a.artifact_role,'content_sha256',a.content_sha256,'storage_bucket',d.storage_bucket,'storage_path',d.storage_path,
      'file_name',d.file_name,'mime_type',d.mime_type,'size_bytes',d.size_bytes));
  END LOOP;
  RETURN jsonb_build_object('opportunity_id',o.id,'repreneur_id',m.repreneur_id,'is_demo',o.is_demo,
    'cycle_id',cycle_event_id,'upstream_id',upstream_event_id,'handoff_type',p_handoff_type,'documents',docs,
    'source_office_id',CASE WHEN p_handoff_type IN ('e4','e7') THEN o.source_office_id ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.journey_external_handoff_context(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_external_handoff_context(uuid,text) TO service_role;

CREATE FUNCTION public.journey_record_external_handoff(
  p_match_id uuid,p_expected_context jsonb,p_operation_key uuid,p_exchange_date date,p_exchange_time time,
  p_channel text,p_reference text,p_staff_user_id text,p_staff_email text,
  p_workspace_id uuid DEFAULT NULL,p_workspace_generation uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE m public.opportunity_matches%ROWTYPE; x public.opportunity_pursuit_external_handoffs%ROWTYPE;
  current_context jsonb; h text; upstream_event_id uuid; event_id uuid:=gen_random_uuid(); receipt_id uuid:=gen_random_uuid();
  recording_time timestamptz:=clock_timestamp(); local_now timestamp:=clock_timestamp() AT TIME ZONE 'Europe/Paris';
BEGIN
  IF NOT public.w196_staff_role_matches(p_staff_user_id,p_staff_email) THEN RAISE EXCEPTION 'external_handoff_staff_denied'; END IF;
  IF p_workspace_id IS NOT NULL OR p_workspace_generation IS NOT NULL THEN
    PERFORM public.w196_assert_staff_portal_workspace(p_workspace_id,p_workspace_generation,
      (p_expected_context->>'repreneur_id')::uuid,p_staff_user_id,p_staff_email);
  END IF;
  PERFORM 1 FROM public.pursuit_external_handoff_settings WHERE singleton AND enabled FOR SHARE NOWAIT;
  IF NOT FOUND OR NOT public.wave_journey_is_enabled() THEN RAISE EXCEPTION 'external_handoff_recording_disabled'; END IF;
  IF p_operation_key IS NULL OR p_expected_context IS NULL OR jsonb_typeof(p_expected_context)<>'object'
    OR p_exchange_date IS NULL OR p_exchange_date>local_now::date
    OR (p_exchange_time IS NOT NULL AND (extract(second FROM p_exchange_time)<>0 OR p_exchange_date+p_exchange_time>local_now))
    OR p_channel IS NULL OR p_channel NOT IN ('email','phone','meeting','other')
    OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 5 AND 500
  THEN RAISE EXCEPTION 'external_handoff_metadata_invalid'; END IF;
  h:=p_expected_context->>'handoff_type'; upstream_event_id:=(p_expected_context->>'upstream_id')::uuid;
  -- Match first follows the existing signed-copy path. NOWAIT on inverted
  -- opportunity/review locks prevents deadlock with opportunity-first bulk send.
  SELECT * INTO m FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'external_handoff_pursuit_stale'; END IF;
  PERFORM 1 FROM public.opportunities WHERE id=m.opportunity_id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.repreneurs WHERE id=m.repreneur_id FOR SHARE NOWAIT;
  IF h IN ('e4','e7') THEN
    PERFORM 1 FROM public.ma_offices office JOIN public.ma_firms firm ON firm.id=office.firm_id
      WHERE office.id=(p_expected_context->>'source_office_id')::uuid FOR SHARE OF office,firm NOWAIT;
  END IF;
  PERFORM 1 FROM public.staff_email_reviews WHERE match_id=m.id AND source_kind=h AND source_operation_id=upstream_event_id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.opportunity_pursuit_handoff_deliveries WHERE match_id=m.id AND upstream_evidence_id=upstream_event_id AND handoff_type=h FOR UPDATE NOWAIT;
  -- Also protect same-key retries across matches, without a unique-violation
  -- race: a lost-response retry may only read its exact immutable request.
  PERFORM pg_advisory_xact_lock(hashtextextended('external-handoff:'||p_operation_key::text,0));
  current_context:=public.journey_external_handoff_context(m.id,h);
  IF current_context IS DISTINCT FROM p_expected_context THEN RAISE EXCEPTION 'external_handoff_context_changed'; END IF;
  PERFORM 1 FROM public.opportunity_nda_artifacts a JOIN public.opportunity_documents d ON d.id=a.document_id
    WHERE a.id IN (SELECT (value->>'artifact_id')::uuid FROM jsonb_array_elements(current_context->'documents')) FOR SHARE OF a,d NOWAIT;
  IF public.journey_external_handoff_context(m.id,h) IS DISTINCT FROM current_context THEN RAISE EXCEPTION 'external_handoff_context_changed'; END IF;
  SELECT * INTO x FROM public.opportunity_pursuit_external_handoffs WHERE operation_key=p_operation_key;
  IF x.id IS NOT NULL THEN
    IF x.match_id IS DISTINCT FROM m.id OR x.context IS DISTINCT FROM current_context OR x.exchange_date IS DISTINCT FROM p_exchange_date
      OR x.exchange_time IS DISTINCT FROM p_exchange_time OR x.channel IS DISTINCT FROM p_channel OR x.reference IS DISTINCT FROM btrim(p_reference)
      OR x.staff_user_id IS DISTINCT FROM p_staff_user_id OR lower(x.staff_email) IS DISTINCT FROM lower(btrim(p_staff_email))
    THEN RAISE EXCEPTION 'external_handoff_retry_conflict'; END IF;
    RETURN x.evidence_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e WHERE e.match_id=m.id
    AND e.event_type=public.journey_handoff_delivery_event_type(h) AND e.metadata->>'upstream_evidence_id'=upstream_event_id::text
    AND public.journey_handoff_is_qualifying(e.id)) THEN RAISE EXCEPTION 'external_handoff_already_completed'; END IF;
  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_handoff_deliveries WHERE match_id=m.id AND upstream_evidence_id=upstream_event_id AND handoff_type=h AND delivery_status IN ('sending','sent'))
    OR EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE match_id=m.id AND source_kind=h AND source_operation_id=upstream_event_id AND state IN ('sending','uncertain','sent'))
    OR (h IN ('e4','e7') AND EXISTS(SELECT 1 FROM public.ma_source_email_send_reservations WHERE opportunity_id=m.opportunity_id AND expires_at>clock_timestamp()))
  THEN RAISE EXCEPTION 'external_handoff_provider_reconciliation_required'; END IF;
  INSERT INTO public.opportunity_pursuit_external_handoffs(id,evidence_id,match_id,opportunity_id,repreneur_id,upstream_evidence_id,
    handoff_type,operation_key,context,exchange_date,exchange_time,channel,reference,staff_user_id,staff_email,recorded_at)
  VALUES(receipt_id,event_id,m.id,m.opportunity_id,m.repreneur_id,upstream_event_id,h,p_operation_key,current_context,p_exchange_date,p_exchange_time,
    p_channel,btrim(p_reference),p_staff_user_id,lower(btrim(p_staff_email)),recording_time);
  PERFORM set_config('wave.external_handoff_finalizing',receipt_id::text,true);
  INSERT INTO public.opportunity_pursuit_evidence(id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,evidence_reference,metadata,recorded_at)
  VALUES(event_id,m.id,m.opportunity_id,m.repreneur_id,public.journey_handoff_delivery_event_type(h),p_staff_user_id,
    'external:'||p_operation_key::text,btrim(p_reference),jsonb_build_object('qualifying_origin','external_staff_v1','external_handoff_id',receipt_id,
      'upstream_evidence_id',upstream_event_id,'operation_key',p_operation_key,'context',current_context,'exchange_date',p_exchange_date,
      'exchange_time',p_exchange_time,'exchange_timezone','Europe/Paris','channel',p_channel),recording_time);
  PERFORM set_config('wave.external_handoff_finalizing','',true);
  RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid) TO service_role;

-- Preserve each existing business function and add only strict origin checks.
-- Fail deployment on source drift rather than silently patch an unknown body.
DO $patch$
DECLARE signature text; definition text; old text; new text;
BEGIN
  FOR signature,old,new IN SELECT * FROM (VALUES
    ('public.journey_record_evidence(uuid,text,text,text,uuid,uuid,text)',
      'event_type=''e4_qualification_requested'' AND metadata', 'event_type=''e4_qualification_requested'' AND public.journey_handoff_is_qualifying(id) AND metadata'),
    ('public.journey_record_evidence(uuid,text,text,text,uuid,uuid,text)',
      'event_type=''e6_nda_ready_notified'' AND metadata', 'event_type=''e6_nda_ready_notified'' AND public.journey_handoff_is_qualifying(id) AND metadata'),
    ('public.journey_current_gate_1_event(uuid)',
      'e4.event_type=''e4_qualification_requested'' AND e4.metadata', 'e4.event_type=''e4_qualification_requested'' AND public.journey_handoff_is_qualifying(e4.id) AND e4.metadata'),
    ('public.journey_current_signed_validation_event(uuid,public.opportunity_nda_artifact_role)',
      'AND e.event_type=CASE p_role',
      'AND EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence e6 WHERE e6.match_id=p_match_id AND e6.event_type=''e6_nda_ready_notified'' AND e6.metadata->>''upstream_evidence_id''=g.id::text AND e6.recorded_at<=e.recorded_at AND public.journey_handoff_is_qualifying(e6.id)) AND e.event_type=CASE p_role'),
    ('public.journey_current_dispatch_event(uuid)',
      'e.event_type=''e7_signed_copies_and_memo_requested''', 'e.event_type=''e7_signed_copies_and_memo_requested'' AND public.journey_handoff_is_qualifying(e.id)'),
    ('public.journey_repreneur_authorized_template(uuid,uuid)',
      'e.event_type=''e6_nda_ready_notified'' AND e.metadata', 'e.event_type=''e6_nda_ready_notified'' AND public.journey_handoff_is_qualifying(e.id) AND e.metadata'),
    ('public.journey_submit_repreneur_signed_copy(uuid,uuid,text,text,text,text,bigint,text)',
      'event_type=''e6_nda_ready_notified'' AND metadata', 'event_type=''e6_nda_ready_notified'' AND public.journey_handoff_is_qualifying(id) AND metadata'),
    ('public.w196_finalize_staff_received_nda(uuid,text,text,text)',
      'e.event_type = ''e6_nda_ready_notified''', 'e.event_type = ''e6_nda_ready_notified'' AND public.journey_handoff_is_qualifying(e.id)'),
    ('public.journey_grant_confidential_access(uuid,uuid,text,text,timestamp with time zone)',
      'event_type=''e7_signed_copies_and_memo_requested'' AND metadata', 'event_type=''e7_signed_copies_and_memo_requested'' AND public.journey_handoff_is_qualifying(id) AND metadata')
  ) AS changes(signature,old,new) LOOP
    definition:=pg_get_functiondef(to_regprocedure(signature));
    IF definition IS NULL OR length(definition)-length(replace(definition,old,''))<>length(old) THEN
      RAISE EXCEPTION 'external_handoff_dependency_drift: %',signature;
    END IF;
    EXECUTE replace(definition,old,new);
  END LOOP;
  signature:='public.journey_begin_handoff_delivery(uuid,uuid,text,text,text,jsonb)';
  definition:=pg_get_functiondef(to_regprocedure(signature));
  old:='  SELECT * INTO v FROM public.opportunity_pursuit_handoff_deliveries WHERE upstream_evidence_id=p_upstream_evidence_id AND handoff_type=p_handoff_type FOR UPDATE;';
  new:=$guard$  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs x WHERE x.match_id=p_match_id AND x.upstream_evidence_id=p_upstream_evidence_id AND x.handoff_type=p_handoff_type) THEN RAISE EXCEPTION 'Handoff already completed externally. No new email may be sent.'; END IF;
$guard$||old;
  IF definition IS NULL OR length(definition)-length(replace(definition,old,''))<>length(old) THEN RAISE EXCEPTION 'external_handoff_begin_dependency_drift'; END IF;
  EXECUTE replace(definition,old,new);
  -- The individual action commits this RPC before it can reserve/authorize the
  -- source or call the provider. Refuse completed external work before writing
  -- any approval/attempt, holding the same match/opportunity fence as recording.
  signature:='public.staff_email_review_reserve(uuid,integer,jsonb,text)';
  definition:=pg_get_functiondef(to_regprocedure(signature));
  old:='  v_token := gen_random_uuid();';
  new:=$guard$  IF v.source_kind IN ('e4','e6','e7') THEN
    PERFORM 1 FROM public.opportunity_matches m
      WHERE m.id=v.match_id AND m.opportunity_id=v.opportunity_id FOR UPDATE NOWAIT;
    IF NOT FOUND THEN RAISE EXCEPTION 'staff_email_review_handoff_source_invalid'; END IF;
    PERFORM 1 FROM public.opportunities WHERE id=v.opportunity_id FOR UPDATE NOWAIT;
    IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs receipt
      JOIN public.opportunity_matches m ON m.id=receipt.match_id AND m.repreneur_id=receipt.repreneur_id
      WHERE receipt.match_id=v.match_id AND receipt.opportunity_id=v.opportunity_id
        AND receipt.upstream_evidence_id=v.source_operation_id AND receipt.handoff_type=v.source_kind
        AND public.journey_handoff_is_qualifying(receipt.evidence_id))
    THEN RAISE EXCEPTION 'external_handoff_already_completed'; END IF;
  END IF;
$guard$||old;
  IF definition IS NULL OR length(definition)-length(replace(definition,old,''))<>length(old) THEN RAISE EXCEPTION 'external_handoff_review_reservation_dependency_drift'; END IF;
  EXECUTE replace(definition,old,new);
END $patch$;

-- Current Email Operations manual approval must clear its automatic claim
-- only after the qualifying-completion fence. Keep both writes transactional:
-- a failed manual-policy mark rolls back the reservation and all its events.
CREATE FUNCTION public.staff_email_review_reserve_manual_handoff(
  p_review_id uuid,p_version integer,p_payload jsonb,p_actor text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE attempt uuid; reserved_version integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=p_review_id AND source_kind IN ('e4','e6','e7'))
    THEN RAISE EXCEPTION 'manual_handoff_review_required'; END IF;
  attempt:=public.staff_email_review_reserve(p_review_id,p_version,p_payload,p_actor);
  SELECT version INTO reserved_version FROM public.staff_email_reviews WHERE id=p_review_id;
  PERFORM public.email_review_mark_manual(p_review_id,reserved_version,p_actor);
  RETURN attempt;
END $$;
REVOKE ALL ON FUNCTION public.staff_email_review_reserve_manual_handoff(uuid,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_email_review_reserve_manual_handoff(uuid,integer,jsonb,text) TO service_role;
COMMIT;
