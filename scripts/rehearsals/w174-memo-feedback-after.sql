-- Independently worked civil-time examples from Ticket #174. The grant day
-- itself is excluded; the next five Monday-Friday dates are counted.
DO $$ BEGIN
  IF public.w174_paris_fifth_weekday_due('2026-03-27 14:30+00')
      IS DISTINCT FROM '2026-04-03 13:30+00'::timestamptz THEN
    RAISE EXCEPTION 'March DST Friday grant did not retain 15:30 Paris time';
  END IF;
  IF public.w174_paris_fifth_weekday_due('2026-10-23 13:30+00')
      IS DISTINCT FROM '2026-10-30 14:30+00'::timestamptz THEN
    RAISE EXCEPTION 'October DST Friday grant did not retain 15:30 Paris time';
  END IF;
  IF public.w174_paris_fifth_weekday_due('2026-03-28 14:30+00')
      IS DISTINCT FROM '2026-04-03 13:30+00'::timestamptz THEN
    RAISE EXCEPTION 'Weekend grant counted the wrong business days';
  END IF;
  IF public.w174_paris_fifth_weekday_due('2026-09-21 13:30+00')
      IS DISTINCT FROM '2026-09-28 13:30+00'::timestamptz THEN
    RAISE EXCEPTION 'Weekday grant did not count five following business days';
  END IF;
END $$;

-- A current canonical E7/Gate-2 fixture is assembled in the disposable DB;
-- the grant itself below uses the unmodified released service RPC and all its
-- normal event/intent triggers. No production fixtures or trigger bypass.
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_memo_feedback_reminders)<>0 THEN
    RAISE EXCEPTION 'Historical grants were replayed into memo reminders';
  END IF;
END $$;
SET session_replication_role=replica;
INSERT INTO public.ma_contacts(id,display_name,first_name,status,created_by) VALUES
  ('74000000-0000-4000-8000-000000000020','Synthetic source contact','Synthetic','active','fixture');
INSERT INTO public.ma_contact_office_affiliations(id,contact_id,office_id,created_by) VALUES
  ('74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000020',
   '74000000-0000-4000-8000-000000000002','fixture');
INSERT INTO public.opportunity_ma_contacts(id,opportunity_id,affiliation_id,contact_name_snapshot,is_primary,linked_by) VALUES
  ('74000000-0000-4000-8000-000000000022','74000000-0000-4000-8000-000000000003',
   '74000000-0000-4000-8000-000000000021','Synthetic source contact',true,'fixture');
INSERT INTO public.opportunity_documents(id,opportunity_id,title,document_type,visibility,storage_path,file_name,mime_type,size_bytes) VALUES
  ('74000000-0000-4000-8000-000000000023','74000000-0000-4000-8000-000000000003','Synthetic blank NDA','nda','staff_only','74000000-0000-4000-8000-000000000003/nda-artifacts/blank_template/blank.pdf','blank.pdf','application/pdf',100),
  ('74000000-0000-4000-8000-000000000024','74000000-0000-4000-8000-000000000003','Synthetic signed NDA R','nda','staff_only','74000000-0000-4000-8000-000000000003/nda-artifacts/renew/signed.pdf','signed.pdf','application/pdf',100),
  ('74000000-0000-4000-8000-000000000025','74000000-0000-4000-8000-000000000003','Synthetic signed NDA B','nda','staff_only','74000000-0000-4000-8000-000000000003/nda-artifacts/repreneur/signed.pdf','signed.pdf','application/pdf',100);
INSERT INTO public.opportunity_nda_artifacts(id,opportunity_id,match_id,document_id,artifact_role,version_number,content_sha256,recorded_by) VALUES
  ('74000000-0000-4000-8000-000000000026','74000000-0000-4000-8000-000000000003',NULL,'74000000-0000-4000-8000-000000000023','blank_template',1,repeat('a',64),'fixture'),
  ('74000000-0000-4000-8000-000000000027','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000024','renew_signed_copy',1,repeat('b',64),'fixture'),
  ('74000000-0000-4000-8000-000000000028','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000025','repreneur_signed_copy',1,repeat('c',64),'fixture');
DO $$ DECLARE v_base TIMESTAMPTZ:=clock_timestamp()-interval '20 minutes'; BEGIN
  INSERT INTO public.opportunity_pursuit_evidence
    (id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,nda_artifact_id,metadata,recorded_at)
  VALUES
  ('74000000-0000-4000-8000-000000000029','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','mutual_interest_validated','w174-staff','fixture-cycle',NULL,'{}',v_base),
  ('74000000-0000-4000-8000-000000000030','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','qualification_requested','w174-staff','fixture-qualification',NULL,'{}',v_base+interval '1 minute'),
  ('74000000-0000-4000-8000-000000000038','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','e4_qualification_requested','w174-staff','fixture-e4',NULL,jsonb_build_object('upstream_evidence_id','74000000-0000-4000-8000-000000000029'),v_base+interval '90 seconds'),
  ('74000000-0000-4000-8000-000000000031','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','intermediary_qualified','w174-staff','fixture-qualified',NULL,'{}',v_base+interval '2 minutes'),
  ('74000000-0000-4000-8000-000000000032','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','template_validated','w174-staff','fixture-template','74000000-0000-4000-8000-000000000026','{}',v_base+interval '3 minutes'),
  ('74000000-0000-4000-8000-000000000033','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','gate_1_passed','w174-staff','fixture-gate1',NULL,'{}',v_base+interval '4 minutes'),
  ('74000000-0000-4000-8000-000000000034','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','renew_signed_copy_validated','w174-staff','fixture-renew-validation','74000000-0000-4000-8000-000000000027','{}',v_base+interval '5 minutes'),
  ('74000000-0000-4000-8000-000000000035','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','repreneur_signed_copy_validated','w174-staff','fixture-repreneur-validation','74000000-0000-4000-8000-000000000028','{}',v_base+interval '6 minutes'),
  ('74000000-0000-4000-8000-000000000036','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','gate_2_passed','w174-staff','fixture-gate2',NULL,
    jsonb_build_object('renew_validation_id','74000000-0000-4000-8000-000000000034','repreneur_validation_id','74000000-0000-4000-8000-000000000035','renew_artifact_id','74000000-0000-4000-8000-000000000027','repreneur_artifact_id','74000000-0000-4000-8000-000000000028'),v_base+interval '7 minutes'),
  ('74000000-0000-4000-8000-000000000037','74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005','e7_signed_copies_and_memo_requested','w174-staff','fixture-e7',NULL,
    jsonb_build_object('upstream_evidence_id','74000000-0000-4000-8000-000000000036'),v_base+interval '8 minutes');
END $$;
RESET session_replication_role;
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(true,true,'fixture')
  ON CONFLICT(singleton) DO UPDATE SET enabled=true,updated_by='fixture';
UPDATE public.email_templates SET is_active=true WHERE template_key='memo_feedback_reminder';
DO $$ DECLARE v_grant UUID; BEGIN
  RAISE NOTICE 'cycle %, gate1 %, renew %, buyer %, gate2 %',
    public.journey_current_cycle_event('74000000-0000-4000-8000-000000000007'),
    public.journey_current_gate_1_event('74000000-0000-4000-8000-000000000007'),
    public.journey_current_signed_validation_event('74000000-0000-4000-8000-000000000007','renew_signed_copy'),
    public.journey_current_signed_validation_event('74000000-0000-4000-8000-000000000007','repreneur_signed_copy'),
    public.journey_current_gate_2_event('74000000-0000-4000-8000-000000000007');
  IF public.journey_current_gate_2_event('74000000-0000-4000-8000-000000000007')
    IS DISTINCT FROM '74000000-0000-4000-8000-000000000036'::uuid THEN
    RAISE EXCEPTION 'Synthetic Gate-2 chain did not resolve';
  END IF;
  v_grant:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-grant',clock_timestamp()+interval '30 days');
  RAISE NOTICE 'grant %, current %, access %, reminder %',v_grant,
    public.w174_grant_is_current(v_grant),
    public.journey_repreneur_can_access_confidential('74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000005','74000000-0000-4000-8000-000000000009'),
    (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_grant);
  IF NOT public.w174_grant_is_current(v_grant)
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_grant)<>'pending'
  THEN RAISE EXCEPTION 'Released grant RPC did not create one eligible current reminder'; END IF;
END $$;
UPDATE public.email_templates SET is_active=false WHERE template_key='memo_feedback_reminder';

-- The new intent table is forward-only. Historical immutable grant evidence
-- must not become a newly queued reminder during migration or key activation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.opportunity_memo_feedback_reminders
      WHERE grant_evidence_id='74000000-0000-4000-8000-000000000011') THEN
    RAISE EXCEPTION 'Historical grants were replayed into memo reminders';
  END IF;
END $$;

-- Fresh grants create one intent per immutable event. Initially inactive and
-- DEMO grants are terminally suppressed; activation never wakes either one.
SELECT set_config('wave.memo_approval_finalizing','74000000-0000-4000-8000-000000000007',false);
INSERT INTO public.opportunity_pursuit_evidence
  (id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,document_id,recorded_at)
VALUES('74000000-0000-4000-8000-000000000012','74000000-0000-4000-8000-000000000007',
  '74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005',
  'confidential_access_granted','w174-staff','inactive-grant','74000000-0000-4000-8000-000000000009',
  '2026-09-22 12:00+00');
UPDATE public.email_templates SET is_active=true WHERE template_key='memo_feedback_reminder';
INSERT INTO public.opportunity_pursuit_evidence
  (id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,document_id,recorded_at)
VALUES('74000000-0000-4000-8000-000000000013','74000000-0000-4000-8000-000000000007',
  '74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000005',
  'confidential_access_granted','w174-staff','active-grant','74000000-0000-4000-8000-000000000009',
  '2026-09-22 12:00+00');
SELECT set_config('wave.memo_approval_finalizing','74000000-0000-4000-8000-000000000008',false);
INSERT INTO public.opportunity_pursuit_evidence
  (id,match_id,opportunity_id,repreneur_id,event_type,actor,idempotency_key,document_id,recorded_at)
VALUES('74000000-0000-4000-8000-000000000014','74000000-0000-4000-8000-000000000008',
  '74000000-0000-4000-8000-000000000004','74000000-0000-4000-8000-000000000006',
  'confidential_access_granted','w174-staff','demo-grant','74000000-0000-4000-8000-000000000010',
  '2026-09-22 12:00+00');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_memo_feedback_reminders)<>4
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders
        WHERE grant_evidence_id='74000000-0000-4000-8000-000000000012')<>'suppressed'
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders
        WHERE grant_evidence_id='74000000-0000-4000-8000-000000000013')<>'pending'
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders
        WHERE grant_evidence_id='74000000-0000-4000-8000-000000000014')<>'suppressed'
  THEN RAISE EXCEPTION 'Grant event intent or activation policy is wrong'; END IF;
END $$;

-- Staff receipt is an immutable, exact-grant fact. An old page cannot cancel
-- a new grant even when the mutable grant row, PDF, and expiry are reused.
DO $$ DECLARE v_a UUID; v_b UUID; v_receipt UUID; v_at TIMESTAMPTZ;
  v_expiry TIMESTAMPTZ; v_denied BOOLEAN;
BEGIN
  SELECT id,recorded_at INTO v_a,v_at FROM public.opportunity_pursuit_evidence
    WHERE match_id='74000000-0000-4000-8000-000000000007'
      AND idempotency_key='w174-real-grant';
  v_at:=clock_timestamp();
  SELECT nda_expires_at INTO v_expiry FROM public.opportunity_pursuit_confidential_grants
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-repreneur-real','email',v_at);
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Non-staff actor recorded feedback'; END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff',NULL,v_at);
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Null feedback channel was accepted'; END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff','phone',v_at-interval '2 minutes');
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Predating feedback was accepted'; END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff','phone',clock_timestamp()+interval '1 minute');
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Future feedback was accepted'; END IF;
  v_receipt:=public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
    'w174-staff','phone',v_at);
  IF v_receipt IS NULL
    OR (SELECT event_type FROM public.opportunity_pursuit_evidence WHERE id=v_receipt)<>'memo_feedback_received'
    OR (SELECT metadata->>'grant_evidence_id' FROM public.opportunity_pursuit_evidence WHERE id=v_receipt)<>v_a::TEXT
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_a)<>'suppressed'
  THEN RAISE EXCEPTION 'Exact feedback did not create evidence and cancel A'; END IF;
  IF public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
    'w174-staff','phone',v_at) IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'Exact receipt retry was not idempotent';
  END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff','email',v_at);
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Receipt details could be overwritten'; END IF;
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','test regrant','w174-revoke-a');
  v_b:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-regrant',v_expiry);
  IF v_b=v_a OR NOT public.w174_grant_is_current(v_b)
    OR public.w174_grant_is_current(v_a)
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_b)<>'pending'
  THEN RAISE EXCEPTION 'Exact new grant B did not supersede A'; END IF;
  IF public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff','phone',v_at) IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'Exact lost-response retry after regrant did not return old receipt';
  END IF;
  v_denied:=false;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',v_a,
      'w174-staff','email',clock_timestamp());
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_b)<>'pending'
  THEN RAISE EXCEPTION 'Stale A page cancelled B'; END IF;
END $$;
