-- A claimed but unstarted reminder loses to same-grant feedback. Once the
-- provider boundary was crossed, a later confirmed provider ID remains a
-- truthful sent receipt even if feedback arrived during that in-flight I/O.
DO $$ DECLARE v_b UUID; v_c UUID; v_expiry TIMESTAMPTZ; v_claim JSONB;
  v_payload JSONB; v_lease UUID; v_receipt UUID; v_before TEXT; v_complete TEXT;
BEGIN
  SELECT id INTO v_b FROM public.opportunity_pursuit_evidence
    WHERE match_id='74000000-0000-4000-8000-000000000007'
      AND idempotency_key='w174-real-regrant';
  IF public.w174_claim_memo_feedback_reminder(v_b)->>'status'<>'not_due' THEN
    RAISE EXCEPTION 'Reminder claimed before its fifth Paris weekday due instant';
  END IF;
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_b;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_b);
  IF v_claim->>'status'<>'claimed' THEN RAISE EXCEPTION 'Due grant B was not claimed'; END IF;
  v_lease:=(v_claim->>'leaseToken')::uuid;
  IF public.w174_memo_feedback_delivery_payload(v_b) IS NULL THEN
    RAISE EXCEPTION 'Current exact grant B has no eligible payload';
  END IF;
  v_receipt:=public.w174_record_memo_feedback(
    '74000000-0000-4000-8000-000000000007',v_b,'w174-staff','email',clock_timestamp());
  IF v_receipt IS NULL OR public.w174_begin_memo_feedback_provider_attempt(
      v_b,v_lease,repeat('a',64),jsonb_build_object('fake','payload'))
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_b)<>'suppressed'
  THEN RAISE EXCEPTION 'Feedback did not cancel an unstarted claimed reminder'; END IF;

  SELECT nda_expires_at INTO v_expiry FROM public.opportunity_pursuit_confidential_grants
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','test provider race','w174-revoke-b');
  v_c:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-grant-c',v_expiry);
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_c;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_c);
  IF v_claim->>'status'<>'claimed' THEN RAISE EXCEPTION 'Due grant C was not claimed'; END IF;
  v_lease:=(v_claim->>'leaseToken')::uuid;
  v_payload:=public.w174_memo_feedback_delivery_payload(v_c);
  IF v_payload IS NULL OR NOT public.w174_begin_memo_feedback_provider_attempt(
      v_c,v_lease,repeat('b',64),v_payload) THEN
    RAISE EXCEPTION 'Current payload failed the provider-boundary fence';
  END IF;
  PERFORM public.w174_record_memo_feedback(
    '74000000-0000-4000-8000-000000000007',v_c,'w174-staff','phone',clock_timestamp());
  SELECT status INTO v_before FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_c;
  v_complete:=public.w174_complete_memo_feedback_reminder(v_c,v_lease,'sent','synthetic-provider-id');
  RAISE NOTICE 'before %, complete %, after %, provider %',v_before,v_complete,
    (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_c),
    (SELECT provider_message_id FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_c);
  IF v_before<>'review_required'
    OR v_complete<>'sent'
    OR (SELECT status FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_c)<>'sent'
    OR (SELECT provider_message_id FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_c)<>'synthetic-provider-id'
  THEN RAISE EXCEPTION 'In-flight feedback lost a known accepted provider receipt'; END IF;
END $$;

-- A changed canonical recipient or template between claim and provider I/O
-- quarantines the old payload instead of sending an out-of-date envelope.
DO $$ DECLARE v_f UUID; v_expiry TIMESTAMPTZ; v_claim JSONB; v_payload JSONB; v_lease UUID;
  v_begin BOOLEAN; v_status TEXT; v_attempted_at TIMESTAMPTZ;
BEGIN
  SELECT nda_expires_at INTO v_expiry FROM public.opportunity_pursuit_confidential_grants
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','test payload drift','w174-revoke-e');
  v_f:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-grant-f',v_expiry);
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_f;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_f);
  v_lease:=(v_claim->>'leaseToken')::uuid;
  v_payload:=public.w174_memo_feedback_delivery_payload(v_f);
  UPDATE public.repreneurs SET email='new-memo-real@example.test'
    WHERE id='74000000-0000-4000-8000-000000000005';
  RAISE NOTICE 'drift claimed %, before %, current %',v_claim->>'status',
    v_payload->>'recipientEmail',public.w174_memo_feedback_delivery_payload(v_f)->>'recipientEmail';
  v_begin:=public.w174_begin_memo_feedback_provider_attempt(v_f,v_lease,repeat('f',64),v_payload);
  SELECT status,provider_attempted_at INTO v_status,v_attempted_at
    FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_f;
  RAISE NOTICE 'drift begin %, status %, attempted %',v_begin,v_status,v_attempted_at;
  IF v_claim->>'status'<>'claimed' OR v_payload IS NULL
    OR v_begin OR v_status<>'review_required' OR v_attempted_at IS NOT NULL
  THEN RAISE EXCEPTION 'Changed recipient was not fenced before provider I/O'; END IF;
END $$;

DO $$ BEGIN
  IF has_table_privilege('anon','public.opportunity_memo_feedback_reminders','SELECT')
    OR has_table_privilege('authenticated','public.opportunity_memo_feedback_reminders','SELECT')
    OR has_function_privilege('anon','public.w174_record_memo_feedback(uuid,uuid,text,text,timestamptz)','EXECUTE')
    OR has_function_privilege('authenticated','public.w174_claim_memo_feedback_reminder(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.w174_memo_feedback_delivery_payload(uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.w174_record_memo_feedback(uuid,uuid,text,text,timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'W174 private service-only ACL is wrong'; END IF;
END $$;

-- An unknown provider acceptance survives retries, no-I/O deferrals, and
-- the 23-hour provider idempotency horizon without a blind new request.
DO $$ DECLARE v_d UUID; v_e UUID; v_expiry TIMESTAMPTZ; v_claim JSONB;
  v_payload JSONB; v_lease UUID; v_first_attempt TIMESTAMPTZ;
BEGIN
  SELECT nda_expires_at INTO v_expiry FROM public.opportunity_pursuit_confidential_grants
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','test uncertainty','w174-revoke-c');
  v_d:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-grant-d',v_expiry);
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_d;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_d);
  v_lease:=(v_claim->>'leaseToken')::uuid;
  v_payload:=public.w174_memo_feedback_delivery_payload(v_d);
  IF v_claim->>'status'<>'claimed' OR NOT public.w174_begin_memo_feedback_provider_attempt(
      v_d,v_lease,repeat('d',64),v_payload) THEN RAISE EXCEPTION 'Unknown-provider setup failed'; END IF;
  IF public.w174_complete_memo_feedback_reminder(v_d,v_lease,'uncertain')<>'uncertain' THEN
    RAISE EXCEPTION 'Provider uncertainty not recorded'; END IF;
  SELECT provider_attempted_at INTO v_first_attempt FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=v_d;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_d);
  v_lease:=(v_claim->>'leaseToken')::uuid;
  IF v_claim->>'status'<>'claimed' OR
    public.w174_complete_memo_feedback_reminder(v_d,v_lease,'deferred')<>'deferred'
    OR (SELECT provider_outcome FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_d)<>'uncertain'
    OR (SELECT provider_attempted_at FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_d)
       IS DISTINCT FROM v_first_attempt THEN
    RAISE EXCEPTION 'No-I/O deferral erased earlier possible provider acceptance'; END IF;
  UPDATE public.opportunity_memo_feedback_reminders
    SET provider_attempted_at=clock_timestamp()-interval '24 hours' WHERE grant_evidence_id=v_d;
  IF public.w174_claim_memo_feedback_reminder(v_d)->>'status'<>'review_required' THEN
    RAISE EXCEPTION 'Uncertain provider request escaped 23-hour review fence'; END IF;

  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','test crash fence','w174-revoke-d');
  v_e:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-real-grant-e',v_expiry);
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_e;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_e);
  v_lease:=(v_claim->>'leaseToken')::uuid;
  v_payload:=public.w174_memo_feedback_delivery_payload(v_e);
  IF v_claim->>'status'<>'claimed' OR NOT public.w174_begin_memo_feedback_provider_attempt(
      v_e,v_lease,repeat('e',64),v_payload) THEN RAISE EXCEPTION 'Crash-provider setup failed'; END IF;
  SELECT provider_attempted_at INTO v_first_attempt FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=v_e;
  UPDATE public.opportunity_memo_feedback_reminders
    SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE grant_evidence_id=v_e;
  v_claim:=public.w174_claim_memo_feedback_reminder(v_e);
  v_lease:=(v_claim->>'leaseToken')::uuid;
  IF v_claim->>'status'<>'claimed'
    OR (SELECT provider_outcome FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_e)<>'uncertain'
    OR (SELECT provider_inflight FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_e)
  THEN RAISE EXCEPTION 'Expired lease did not preserve crashed provider uncertainty'; END IF;
  PERFORM public.w174_complete_memo_feedback_reminder(v_e,v_lease,'deferred');
  IF (SELECT provider_attempted_at FROM public.opportunity_memo_feedback_reminders WHERE grant_evidence_id=v_e)
    IS DISTINCT FROM v_first_attempt THEN RAISE EXCEPTION 'Crash then deferred erased attempt time'; END IF;
  UPDATE public.opportunity_memo_feedback_reminders
    SET provider_attempted_at=clock_timestamp()-interval '24 hours' WHERE grant_evidence_id=v_e;
  IF public.w174_claim_memo_feedback_reminder(v_e)->>'status'<>'review_required' THEN
    RAISE EXCEPTION 'Crashed provider request escaped 23-hour review fence'; END IF;
END $$;
