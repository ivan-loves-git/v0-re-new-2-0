-- AC-03: absent blank template can be requested, future-phase documents do not block E4.
SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',
  public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e4'),
  '25400000-0000-4000-8000-000000000001',current_date-1,NULL,'phone','Synthetic qualification and blank NDA request',
  'w173-staff','w173-staff@example.test');
-- AC-04: E6 cannot invent qualification, template or Gate 1.
DO $$ BEGIN
  BEGIN PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e6');
    RAISE EXCEPTION 'missing_gate_1_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_approval_not_ready' THEN RAISE; END IF; END;
END $$;

-- AC-04/06/07: human approvals remain separate and use current canonical files.
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','intermediary_qualified','w173-staff@example.test','254-qualified');
SELECT * FROM public.register_opportunity_nda_artifact('76000000-0000-4000-8000-000000000003',NULL,'blank_template','Synthetic blank NDA',
  '76000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/254-blank.pdf','blank.pdf',100,repeat('a',64),'w173-staff@example.test');
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','template_validated','w173-staff@example.test','254-template',
  public.journey_current_template_id('76000000-0000-4000-8000-000000000011'));
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','gate_1_passed','w173-staff@example.test','254-gate1');
-- Keep one exact E6 request for retries and independent-session races.
CREATE TABLE public.synthetic_254_context AS SELECT public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e6') AS context;
INSERT INTO public."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES('w173-staff','Synthetic staff','w173-staff@example.test',true,now(),now());
-- AC-06: historical-looking bare dispatch evidence remains non-qualifying.
SET session_replication_role=replica;
INSERT INTO public.opportunity_pursuit_evidence(id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,metadata)
SELECT '25400000-0000-4000-8000-000000000080','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','e6_nda_ready_notified','historical-note','254-historical-note',jsonb_build_object('upstream_evidence_id',context->>'upstream_id') FROM public.synthetic_254_context;
RESET session_replication_role;
DO $$ BEGIN
  IF public.journey_handoff_is_qualifying('25400000-0000-4000-8000-000000000080')
    OR EXISTS(SELECT 1 FROM public.journey_repreneur_authorized_template('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004'))
  THEN RAISE EXCEPTION 'historical_note_promoted'; END IF;
  BEGIN INSERT INTO public.opportunity_pursuit_evidence(match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,metadata)
    SELECT '76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','e6_nda_ready_notified','w173-staff','254-fabricated',jsonb_build_object('upstream_evidence_id',context->>'upstream_id','qualifying_origin','external_staff_v1') FROM public.synthetic_254_context;
    RAISE EXCEPTION 'fabrication_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Handoff evidence requires its protected finalizer.' THEN RAISE; END IF; END;
END $$;
-- A real protected source reservation creates uncertainty; external completion cannot bypass it.
SELECT * FROM public.journey_begin_handoff_delivery('76000000-0000-4000-8000-000000000011',public.journey_current_gate_1_event('76000000-0000-4000-8000-000000000011'),'e6',repeat('b',64),'w173-staff');
DO $$ BEGIN
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000002',current_date-1,NULL,'email','Synthetic external NDA notice','w173-staff','w173-staff@example.test');
    RAISE EXCEPTION 'uncertainty_bypassed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_provider_reconciliation_required' THEN RAISE; END IF; END;
END $$;
SELECT public.journey_finalize_handoff_delivery(id,operation_key,'w173-staff','failed',NULL,'Synthetic conclusive provider rejection',NULL)
FROM public.opportunity_pursuit_handoff_deliveries WHERE handoff_type='e6';
INSERT INTO public.staff_email_reviews(source_kind,source_operation_id,opportunity_id,match_id,upstream_evidence_id,recipient_email,namespace,template_key,template_version,subject,body_text,created_by)
SELECT 'e6',(context->>'upstream_id')::uuid,'76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011',(context->>'upstream_id')::uuid,'synthetic@example.test','REAL','code:e6_nda_ready','w112-e6-v1','Synthetic notice','Synthetic body','w173-staff' FROM public.synthetic_254_context;
-- Metadata/ownership are independently refused and leave no receipt.
DO $$ DECLARE c jsonb:=(SELECT context FROM public.synthetic_254_context); BEGIN
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',c,'25400000-0000-4000-8000-000000000009',current_date+1,NULL,'email','Future synthetic exchange','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'future_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_metadata_invalid' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',c,'25400000-0000-4000-8000-000000000009',current_date-1,NULL,'email','Wrong role synthetic exchange','w173-repreneur-interest','interested@example.test'); RAISE EXCEPTION 'role_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_staff_denied' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',jsonb_set(c,'{repreneur_id}','"76000000-0000-4000-8000-000000000007"'),'25400000-0000-4000-8000-000000000009',current_date-1,NULL,'email','Wrong owner synthetic exchange','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'owner_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_context_changed' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',jsonb_set(c,'{is_demo}','true'),'25400000-0000-4000-8000-000000000009',current_date-1,NULL,'email','Wrong namespace synthetic exchange','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'namespace_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_context_changed' THEN RAISE; END IF; END;
END $$;
SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
  '25400000-0000-4000-8000-000000000002',current_date-1,NULL,'email','Synthetic external NDA notice','w173-staff','w173-staff@example.test',
  '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089');
DO $$ DECLARE original uuid; retried uuid; BEGIN
  SELECT evidence_id INTO original FROM public.opportunity_pursuit_external_handoffs WHERE handoff_type='e6';
  retried:=public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000002',current_date-1,NULL,'email','Synthetic external NDA notice','w173-staff','w173-staff@example.test');
  IF retried<>original OR NOT public.journey_handoff_is_qualifying(original)
    OR (SELECT count(*) FROM public.opportunity_pursuit_external_handoffs WHERE handoff_type='e6')<>1
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_external_handoffs WHERE handoff_type='e6' AND exchange_time IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE id=original AND metadata ? 'provider_message_id')
    OR NOT EXISTS(SELECT 1 FROM public.journey_repreneur_authorized_template('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004'))
  THEN RAISE EXCEPTION 'external_e6_retry_or_downstream_failed'; END IF;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000002',current_date-1,'12:00','email','Contradictory synthetic exchange','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'conflict_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_retry_conflict' THEN RAISE; END IF; END;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000099',current_date-1,NULL,'email','Repeated completed exchange','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'repeated_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_already_completed' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.journey_begin_handoff_delivery('76000000-0000-4000-8000-000000000011',public.journey_current_gate_1_event('76000000-0000-4000-8000-000000000011'),'e6',repeat('b',64),'w173-staff'); RAISE EXCEPTION 'stale_send_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Handoff already completed externally. No new email may be sent.' THEN RAISE; END IF; END;
  BEGIN DELETE FROM public.opportunity_pursuit_external_handoffs WHERE evidence_id=original; RAISE EXCEPTION 'delete_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_immutable' THEN RAISE; END IF; END;
END $$;
BEGIN;
SELECT public.w196_select_staff_portal_workspace('76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000007','w173-staff','w173-staff@example.test');
DO $$ BEGIN
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000002',current_date-1,NULL,'email','Synthetic external NDA notice','w173-staff','w173-staff@example.test',
    '76000000-0000-4000-8000-000000000090','76000000-0000-4000-8000-000000000089'); RAISE EXCEPTION 'stale_workspace_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'staff_portal_selection_changed' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
-- AC-06: existing staff-received signed-copy route accepts qualifying external E6,
-- while adding neither validation nor access. Its actual workspace capability is held.
INSERT INTO public.private_upload_intents(id,actor_kind,actor_key,actor_user_id,actor_email,upload_kind,resource_id,related_id,bucket_id,storage_path,original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
VALUES('25400000-0000-4000-8000-000000000078','staff','staff:w173-staff:','w173-staff','w173-staff@example.test','staff_received_signed_nda',
  '76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','opportunity-documents',
  '76000000-0000-4000-8000-000000000003/nda-artifacts/repreneur_signed_copy/25400000-0000-4000-8000-000000000078-signed.pdf','signed.pdf','application/pdf',100,
  jsonb_build_object('opportunity_id','76000000-0000-4000-8000-000000000003','title','Synthetic externally received copy','source_kind','email','source_reference','Synthetic inbox receipt','staff_portal_workspace_id','76000000-0000-4000-8000-000000000090','staff_portal_generation','76000000-0000-4000-8000-000000000089'),
  '25400000-0000-4000-8000-000000000078',repeat('b',64),clock_timestamp()+interval '1 hour');
SELECT public.w196_finalize_staff_received_nda('25400000-0000-4000-8000-000000000078','staff:w173-staff:',repeat('b',64),repeat('c',64));
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence WHERE event_type IN ('repreneur_signed_copy_validated','gate_2_passed','confidential_access_granted'))
    OR (SELECT count(*) FROM public.staff_received_nda_receipts)<>1 THEN RAISE EXCEPTION 'staff_received_side_effect'; END IF;
  BEGIN PERFORM public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e7'); RAISE EXCEPTION 'e7_before_gate2_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_approval_not_ready' THEN RAISE; END IF; END;
END $$;
SELECT * FROM public.register_opportunity_nda_artifact('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000011','renew_signed_copy','Synthetic Re-New copy',
  '76000000-0000-4000-8000-000000000003/nda-artifacts/renew_signed_copy/254-renew.pdf','renew.pdf',100,repeat('d',64),'w173-staff@example.test');
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','renew_signed_copy_validated','w173-staff@example.test','254-renew-valid',
  (SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='renew_signed_copy'));
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','repreneur_signed_copy_validated','w173-staff@example.test','254-buyer-valid',
  (SELECT id FROM public.opportunity_nda_artifacts WHERE artifact_role='repreneur_signed_copy'));
SELECT public.journey_record_evidence('76000000-0000-4000-8000-000000000011','gate_2_passed','w173-staff@example.test','254-gate2');
SELECT public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',
  public.journey_external_handoff_context('76000000-0000-4000-8000-000000000011','e7'),
  '25400000-0000-4000-8000-000000000003',current_date-1,'12:00','meeting','Synthetic signed-copy transfer and memo request','w173-staff','w173-staff@example.test');
DO $$ BEGIN
  IF public.journey_current_dispatch_event('76000000-0000-4000-8000-000000000011') IS NULL
    OR (SELECT jsonb_array_length(context->'documents') FROM public.opportunity_pursuit_external_handoffs WHERE handoff_type='e7')<>2
    OR EXISTS(SELECT 1 FROM public.opportunity_pursuit_confidential_grants)
    OR EXISTS(SELECT 1 FROM public.ma_interactions) THEN RAISE EXCEPTION 'external_e7_document_or_side_effect'; END IF;
  IF has_table_privilege('authenticated','public.opportunity_pursuit_external_handoffs','SELECT')
    OR has_table_privilege('service_role','public.opportunity_pursuit_external_handoffs','INSERT')
    OR has_function_privilege('authenticated','public.staff_email_review_reserve_manual_handoff(uuid,integer,jsonb,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.staff_email_review_reserve_manual_handoff(uuid,integer,jsonb,text)','EXECUTE')
    OR has_function_privilege('anon','public.journey_record_external_handoff(uuid,jsonb,uuid,date,time,text,text,text,text,uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'external_acl_failed'; END IF;
END $$;
-- AC-25: disable new recording; keep qualifying reader/template authorization and immutable truth.
UPDATE public.pursuit_external_handoff_settings SET enabled=false;
DO $$ BEGIN
  IF public.journey_current_dispatch_event('76000000-0000-4000-8000-000000000011') IS NULL
    OR NOT EXISTS(SELECT 1 FROM public.journey_repreneur_authorized_template('76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004'))
  THEN RAISE EXCEPTION 'disable_lost_authorization'; END IF;
  BEGIN PERFORM public.journey_record_external_handoff('76000000-0000-4000-8000-000000000011',(SELECT context FROM public.synthetic_254_context),
    '25400000-0000-4000-8000-000000000099',current_date-1,NULL,'email','Disabled external record','w173-staff','w173-staff@example.test'); RAISE EXCEPTION 'disable_allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_recording_disabled' THEN RAISE; END IF; END;
END $$;
UPDATE public.pursuit_external_handoff_settings SET enabled=true;
-- Individual send order reserves the review before any source authorization.
-- Every externally completed phase must refuse that first RPC atomically.
DO $$ DECLARE receipt public.opportunity_pursuit_external_handoffs%ROWTYPE;
  target_review_id uuid; original_review jsonb; original_events bigint; begin_snapshot jsonb;
  original_deliveries jsonb; original_reservations jsonb; original_authorizations jsonb;
BEGIN
  FOR receipt IN SELECT * FROM public.opportunity_pursuit_external_handoffs ORDER BY handoff_type LOOP
    IF receipt.handoff_type='e6' THEN
      SELECT id INTO target_review_id FROM public.staff_email_reviews WHERE source_kind='e6' AND source_operation_id=receipt.upstream_evidence_id;
    ELSE
      target_review_id:=public.staff_email_review_prepare(receipt.handoff_type,receipt.upstream_evidence_id,
        receipt.opportunity_id,receipt.match_id,receipt.upstream_evidence_id,'25400000-0000-4000-8000-000000000093',
        'source@example.invalid','REAL','ma_nda_info_memo_request','synthetic-copy','Synthetic subject','Synthetic body','[]','w173-staff');
    END IF;
    UPDATE public.staff_email_reviews SET prepared_policy='{"auto_send":true,"version":2,"auto_claimed_at":"2026-10-07T09:00:00Z"}' WHERE id=target_review_id;
    SELECT to_jsonb(review) INTO original_review FROM public.staff_email_reviews review WHERE id=target_review_id;
    SELECT count(*) INTO original_events FROM public.staff_email_review_events WHERE staff_email_review_events.review_id=target_review_id;
    SELECT jsonb_agg(to_jsonb(delivery) ORDER BY id) INTO original_deliveries FROM public.opportunity_pursuit_handoff_deliveries delivery;
    SELECT jsonb_agg(to_jsonb(reservation) ORDER BY opportunity_id) INTO original_reservations FROM public.ma_source_email_send_reservations reservation;
    SELECT jsonb_agg(to_jsonb(policy_event) ORDER BY id) INTO original_authorizations FROM public.ma_contact_email_policy_events policy_event;
    BEGIN
      PERFORM public.staff_email_review_reserve_manual_handoff(target_review_id,(original_review->>'version')::integer,'{"subject":"Synthetic subject","text":"Synthetic body"}','w173-staff');
      RAISE EXCEPTION 'externally_completed_review_reserved: %',receipt.handoff_type;
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_already_completed' THEN RAISE; END IF; END;
    -- Automatic reservation retains the same exact completion fence; bulk's
    -- begin-first source gate must refuse before creating a delivery as well.
    BEGIN
      PERFORM public.staff_email_review_reserve(target_review_id,(original_review->>'version')::integer,'{"subject":"Synthetic subject","text":"Synthetic body"}','w173-staff');
      RAISE EXCEPTION 'externally_completed_automatic_review_reserved';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'external_handoff_already_completed' THEN RAISE; END IF; END;
    begin_snapshot:='[]'::jsonb;
    IF receipt.handoff_type='e7' THEN
      SELECT jsonb_agg(jsonb_build_object('artifact_id',artifact.id,'document_id',document.id,
        'content_sha256',artifact.content_sha256,'file_name',document.file_name,'mime_type',document.mime_type,'size_bytes',document.size_bytes)
        ORDER BY CASE artifact.artifact_role WHEN 'renew_signed_copy' THEN 1 ELSE 2 END)
      INTO begin_snapshot FROM jsonb_array_elements(receipt.context->'documents') snapshot
        JOIN public.opportunity_nda_artifacts artifact ON artifact.id=(snapshot->>'artifact_id')::uuid
        JOIN public.opportunity_documents document ON document.id=artifact.document_id;
    END IF;
    BEGIN
      PERFORM * FROM public.journey_begin_handoff_delivery(receipt.match_id,receipt.upstream_evidence_id,receipt.handoff_type,repeat('f',64),'w173-staff',begin_snapshot);
      RAISE EXCEPTION 'externally_completed_bulk_source_began';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Handoff already completed externally. No new email may be sent.' THEN RAISE; END IF; END;
    IF (SELECT to_jsonb(review) FROM public.staff_email_reviews review WHERE id=target_review_id) IS DISTINCT FROM original_review
      OR (SELECT count(*) FROM public.staff_email_review_events WHERE staff_email_review_events.review_id=target_review_id)<>original_events
      OR (SELECT jsonb_agg(to_jsonb(delivery) ORDER BY id) FROM public.opportunity_pursuit_handoff_deliveries delivery) IS DISTINCT FROM original_deliveries
      OR (SELECT jsonb_agg(to_jsonb(reservation) ORDER BY opportunity_id) FROM public.ma_source_email_send_reservations reservation) IS DISTINCT FROM original_reservations
      OR (SELECT jsonb_agg(to_jsonb(policy_event) ORDER BY id) FROM public.ma_contact_email_policy_events policy_event) IS DISTINCT FROM original_authorizations
      OR EXISTS(SELECT 1 FROM public.ma_interactions)
    THEN RAISE EXCEPTION 'external_reservation_denial_changed_truth: %',receipt.handoff_type; END IF;
  END LOOP;
END $$;
-- Old external receipts never block a newly validated cycle's different upstream.
BEGIN;
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','drop','w173-staff@example.test','254-future-drop','buyer_search_paused');
SELECT public.journey_transition_terminal('76000000-0000-4000-8000-000000000011','reopen','w173-staff@example.test','254-future-reopen');
DO $$ DECLARE new_cycle uuid; new_review uuid; attempt uuid; manual_definition text; original_review jsonb; original_events bigint;
BEGIN
  new_cycle:=public.journey_start_pursuit('76000000-0000-4000-8000-000000000011','w173-staff@example.test','254-future-validation');
  new_review:=public.staff_email_review_prepare('e4',new_cycle,'76000000-0000-4000-8000-000000000003',
    '76000000-0000-4000-8000-000000000011',new_cycle,'25400000-0000-4000-8000-000000000093',
    'source@example.invalid','REAL','ma_nda_info_memo_request','synthetic-copy','Synthetic future request','Synthetic body','[]','w173-staff');
  UPDATE public.staff_email_reviews SET prepared_policy='{"auto_send":true,"version":2,"auto_claimed_at":"2026-10-07T09:00:00Z"}' WHERE id=new_review;
  SELECT to_jsonb(review) INTO original_review FROM public.staff_email_reviews review WHERE id=new_review;
  SELECT count(*) INTO original_events FROM public.staff_email_review_events WHERE review_id=new_review;
  manual_definition:=pg_get_functiondef('public.email_review_mark_manual(uuid,integer,text)'::regprocedure);
  EXECUTE $fault$CREATE OR REPLACE FUNCTION public.email_review_mark_manual(p_review_id uuid,p_version integer,p_actor text) RETURNS void LANGUAGE plpgsql AS $body$ BEGIN RAISE EXCEPTION 'synthetic_manual_policy_failure'; END $body$;$fault$;
  BEGIN
    PERFORM public.staff_email_review_reserve_manual_handoff(new_review,1,'{"subject":"Synthetic future request"}','w173-staff');
    RAISE EXCEPTION 'manual_policy_failure_not_propagated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'synthetic_manual_policy_failure' THEN RAISE; END IF; END;
  IF (SELECT to_jsonb(review) FROM public.staff_email_reviews review WHERE id=new_review) IS DISTINCT FROM original_review
    OR (SELECT count(*) FROM public.staff_email_review_events WHERE review_id=new_review)<>original_events
    THEN RAISE EXCEPTION 'manual_policy_failure_stranded_reservation'; END IF;
  EXECUTE manual_definition;
  attempt:=public.staff_email_review_reserve_manual_handoff(new_review,1,'{"subject":"Synthetic future request"}','w173-staff');
  IF attempt IS NULL OR NOT EXISTS(SELECT 1 FROM public.staff_email_reviews WHERE id=new_review AND state='sending' AND version=2 AND prepared_policy='{"auto_send":true,"version":2}'::jsonb)
  THEN RAISE EXCEPTION 'future_cycle_blocked_by_old_external_receipt'; END IF;
END $$;
ROLLBACK;
