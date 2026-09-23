\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(true,true,'fixture')
  ON CONFLICT(singleton) DO UPDATE SET enabled=true,updated_by='fixture';
SET session_replication_role=replica;
UPDATE public.opportunity_matches SET status='active_pursuit'
  WHERE id='76000000-0000-4000-8000-000000000011';
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_path,file_name,mime_type,size_bytes)
VALUES ('76000000-0000-4000-8000-000000000070','76000000-0000-4000-8000-000000000003',
  'Synthetic blank NDA','nda','staff_only',
  '76000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/test.pdf',
  'test.pdf','application/pdf',100);
INSERT INTO public.opportunity_nda_artifacts(id,opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,recorded_by)
VALUES ('76000000-0000-4000-8000-000000000071','76000000-0000-4000-8000-000000000003',NULL,
  '76000000-0000-4000-8000-000000000070','blank_template',1,repeat('a',64),'fixture');
DO $$ DECLARE t timestamptz := clock_timestamp()-interval '20 minutes'; BEGIN
  INSERT INTO public.opportunity_pursuit_evidence
    (id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,nda_artifact_id,metadata,recorded_at)
  VALUES
  ('76000000-0000-4000-8000-000000000072','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','mutual_interest_validated','fixture','w196-cycle',NULL,'{}',t),
  ('76000000-0000-4000-8000-000000000073','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','e4_qualification_requested','fixture','w196-e4',NULL,jsonb_build_object('upstream_evidence_id','76000000-0000-4000-8000-000000000072'),t+interval '1 minute'),
  ('76000000-0000-4000-8000-000000000074','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','intermediary_qualified','fixture','w196-qualified',NULL,'{}',t+interval '2 minutes'),
  ('76000000-0000-4000-8000-000000000075','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','template_validated','fixture','w196-template','76000000-0000-4000-8000-000000000071','{}',t+interval '3 minutes'),
  ('76000000-0000-4000-8000-000000000076','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','gate_1_passed','fixture','w196-gate1',NULL,'{}',t+interval '4 minutes'),
  ('76000000-0000-4000-8000-000000000077','76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000004','e6_nda_ready_notified','fixture','w196-e6',NULL,jsonb_build_object('upstream_evidence_id','76000000-0000-4000-8000-000000000076'),t+interval '5 minutes');
END $$;
RESET session_replication_role;
DO $$ DECLARE v_result jsonb; v_intent uuid := '76000000-0000-4000-8000-000000000078'; BEGIN
  IF public.journey_current_gate_1_event('76000000-0000-4000-8000-000000000011')
    IS DISTINCT FROM '76000000-0000-4000-8000-000000000076'::uuid
  THEN RAISE EXCEPTION 'w196_fixture_gate_not_current'; END IF;
  INSERT INTO public.private_upload_intents
    (id,actor_kind,actor_key,actor_user_id,actor_email,upload_kind,resource_id,related_id,bucket_id,
      storage_path,original_filename,content_type,declared_size,metadata,idempotency_key,finalize_secret_hash,expires_at)
  VALUES (v_intent,'staff','staff:w173-staff:','w173-staff','w173-staff@example.test','staff_received_signed_nda',
    '76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','opportunity-documents',
    '76000000-0000-4000-8000-000000000003/nda-artifacts/repreneur_signed_copy/76000000-0000-4000-8000-000000000078-signed.pdf',
    'signed.pdf','application/pdf',100,
    jsonb_build_object('opportunity_id','76000000-0000-4000-8000-000000000003','title','Signed copy received',
      'source_kind','email','source_reference','Synthetic inbox reference'),
    '76000000-0000-4000-8000-000000000078',repeat('b',64),clock_timestamp()+interval '1 hour');
  v_result := public.w196_finalize_staff_received_nda(v_intent,'staff:w173-staff:',repeat('b',64),repeat('c',64));
  IF v_result->>'artifactId' IS NULL
    OR (SELECT uploaded_by FROM public.opportunity_documents WHERE id=(v_result->>'documentId')::uuid) <> 'w173-staff'
    OR (SELECT recorded_by FROM public.opportunity_nda_artifacts WHERE id=(v_result->>'artifactId')::uuid) <> 'w173-staff@example.test'
    OR (SELECT staff_user_id FROM public.staff_received_nda_receipts WHERE intent_id=v_intent) <> 'w173-staff'
    OR EXISTS (SELECT 1 FROM public.opportunity_pursuit_evidence WHERE match_id='76000000-0000-4000-8000-000000000011'
      AND event_type IN ('repreneur_signed_copy_validated','gate_2_passed'))
  THEN RAISE EXCEPTION 'w196_receipt_or_gate_attribution'; END IF;
  IF public.w196_finalize_staff_received_nda(v_intent,'staff:w173-staff:',repeat('b',64),repeat('c',64))->>'artifactId'
    IS DISTINCT FROM v_result->>'artifactId' THEN RAISE EXCEPTION 'w196_nda_retry'; END IF;
END $$;
DO $$ BEGIN
  IF has_table_privilege('authenticated','public.staff_received_nda_receipts','SELECT')
    OR has_table_privilege('service_role','public.staff_received_nda_receipts','INSERT')
    OR has_function_privilege('anon','public.w196_finalize_staff_received_nda(uuid,text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'w196_nda_acl'; END IF;
END $$;
ROLLBACK;
