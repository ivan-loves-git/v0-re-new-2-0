-- All values are fictional. The fixture deliberately moves DB clocks after
-- immutable event creation solely to rehearse a complete three-day window.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.email_templates
    WHERE template_key='opportunity_discovery_digest' AND is_active=false AND requires_consent=true) THEN
    RAISE EXCEPTION 'default OFF template missing'; END IF;
  IF EXISTS(SELECT 1 FROM public.discovery_digest_cutover) THEN RAISE EXCEPTION 'cutover initialized by migration'; END IF;
  IF has_table_privilege('anon','public.discovery_digest_deliveries','SELECT')
    OR has_table_privilege('authenticated','public.discovery_digest_optouts','SELECT')
    OR has_table_privilege('authenticated','public.discovery_digest_attempts','SELECT')
    OR has_table_privilege('authenticated','public.discovery_digest_reconciliations','SELECT')
    OR has_function_privilege('authenticated','public.d136_toggle(text,boolean)','EXECUTE')
    OR has_function_privilege('anon','public.d136_claim(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.d136_reconcile(uuid,text,text,boolean,text)','EXECUTE') THEN
    RAISE EXCEPTION 'raw digest role boundary failed'; END IF;
END $$;
INSERT INTO public."user"(id,email,"emailVerified") VALUES('staff-d136','staff@fictional.test',true);
INSERT INTO public.app_user_roles(user_id,email,role)
VALUES('staff-d136','staff@fictional.test','staff');
DO $$ BEGIN
  IF NOT public.d136_staff_actor('staff-d136') THEN
    RAISE EXCEPTION 'linked fictional staff actor denied'; END IF;
  UPDATE public.app_user_roles SET user_id=NULL WHERE email='staff@fictional.test';
  IF NOT public.d136_staff_actor('staff-d136') THEN
    RAISE EXCEPTION 'legacy email-only staff actor denied'; END IF;
  UPDATE public.app_user_roles SET user_id='staff-d136' WHERE email='staff@fictional.test';
END $$;

-- No cutover and no active epoch: an ordinary active creation retains only an
-- ineligible first observation. There is no migration-time event/backfill.
SELECT public.create_ordinary_discovery_opportunity(
  p_reference=>'FIC-PRE',p_target_status=>'active',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Earlier fictional deal","teaser_summary":"Earlier safe public copy"}'::jsonb);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.discovery_digest_origins)<>1
    OR (SELECT count(*) FROM public.discovery_digest_first_availability WHERE epoch_id IS NULL)<>1 THEN
    RAISE EXCEPTION 'precutover ordinary origin not held ineligible'; END IF;
END $$;
SELECT public.d136_initialize_cutover('staff-d136','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
DO $$ DECLARE first_time timestamptz; BEGIN
  SELECT initialized_at INTO first_time FROM public.discovery_digest_cutover;
  IF public.d136_initialize_cutover('staff-d136','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')<>first_time THEN
    RAISE EXCEPTION 'cutover replay changed time'; END IF;
  BEGIN
    PERFORM public.d136_initialize_cutover('staff-d136','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    RAISE EXCEPTION 'different cutover proof accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='different cutover proof accepted' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.email_templates SET is_active=true WHERE template_key='opportunity_discovery_digest';
    RAISE EXCEPTION 'generic template toggle bypassed guard';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='generic template toggle bypassed guard' THEN RAISE; END IF;
  END;
END $$;
SELECT public.d136_toggle('staff-d136',true);

SELECT public.create_ordinary_discovery_opportunity(
  p_reference=>'FIC-A',p_target_status=>'active',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Fictional workshop","teaser_summary":"A safe public industrial summary."}'::jsonb);
SELECT public.create_ordinary_discovery_opportunity(
  p_reference=>'FIC-B',p_target_status=>'draft',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Fictional distributor","teaser_summary":"A safe public distribution summary."}'::jsonb);
SELECT public.create_opportunity_with_office_context_v2(
  p_reference=>'FIC-DIRECT-V2',p_target_status=>'active',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Unmarked","teaser_summary":"Unmarked"}'::jsonb);
INSERT INTO public.opportunities(reference,status,is_demo,repreneur_exposure,public_title,teaser_summary)
VALUES('FIC-GENERIC','active',false,'anonymized','Generic','Generic');
UPDATE public.opportunities SET status='active',repreneur_exposure='anonymized'
WHERE reference='FIC-B';
UPDATE public.opportunities SET status='active' WHERE reference='FIC-A';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.discovery_digest_origins)<>3
    OR (SELECT count(*) FROM public.discovery_digest_first_availability)<>3
    OR EXISTS(SELECT 1 FROM public.discovery_digest_origins origin
      JOIN public.opportunities o ON o.id=origin.opportunity_id
      WHERE o.reference IN ('FIC-DIRECT-V2','FIC-GENERIC'))
    OR (SELECT count(*) FROM public.discovery_digest_first_availability a
      JOIN public.opportunities o ON o.id=a.opportunity_id WHERE o.reference='FIC-A')<>1 THEN
    RAISE EXCEPTION 'ordinary-only origin or first-event once failed'; END IF;
END $$;
UPDATE public.opportunities SET
  public_description_approved_hash=encode(sha256(convert_to(teaser_summary,'UTF8')),'hex'),
  public_description_approved_at=clock_timestamp(),public_description_approved_by='staff-d136'
WHERE reference IN ('FIC-A','FIC-B');
SELECT public.d136_approve_copy(id,'staff-d136',public_title,teaser_summary)
FROM public.opportunities WHERE reference IN ('FIC-A','FIC-B');
DO $$ DECLARE o public.opportunities%ROWTYPE; BEGIN
  SELECT * INTO o FROM public.opportunities WHERE reference='FIC-A';
  BEGIN
    PERFORM public.d136_approve_copy(o.id,'staff-d136','unseen changed title',o.teaser_summary);
    RAISE EXCEPTION 'unseen copy approval accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='unseen copy approval accepted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.d136_opt_out('staff-d136');
    RAISE EXCEPTION 'staff created an owner opt-out';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='staff created an owner opt-out' THEN RAISE; END IF;
  END;
END $$;

INSERT INTO public.repreneurs(id,email,first_name,last_name,marketing_consent,is_demo) VALUES
 ('13600000-0000-4000-8000-000000000001','buyer1@fictional.test','Fictional','One',true,false),
 ('13600000-0000-4000-8000-000000000002','buyer2@fictional.test','Fictional','Two',true,false),
 ('13600000-0000-4000-8000-000000000003','buyer3@fictional.test','Fictional','Three',true,false),
 ('13600000-0000-4000-8000-000000000004','buyer4@fictional.test','Fictional','Four',true,false),
 ('13600000-0000-4000-8000-000000000005','buyer5@fictional.test','Fictional','Five',true,false),
 ('13600000-0000-4000-8000-000000000006','no-credential@fictional.test','Fictional','Six',true,false);
INSERT INTO public."user"(id,email,"emailVerified") VALUES
 ('buyer-1','buyer1@fictional.test',true),('buyer-2','buyer2@fictional.test',true),
 ('buyer-3','buyer3@fictional.test',true),('buyer-4','buyer4@fictional.test',true),
 ('buyer-5','buyer5@fictional.test',true),('buyer-6','no-credential@fictional.test',true);
INSERT INTO public."account"(id,"userId","accountId","providerId",password) VALUES
 ('credential-1','buyer-1','buyer-1','credential','fictional-hash'),
 ('credential-2','buyer-2','buyer-2','credential','fictional-hash'),
 ('credential-3','buyer-3','buyer-3','credential','fictional-hash'),
 ('credential-4','buyer-4','buyer-4','credential','fictional-hash'),
 ('credential-5','buyer-5','buyer-5','credential','fictional-hash');
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id,access_enabled_at) VALUES
 ('buyer-1','buyer1@fictional.test','repreneur','13600000-0000-4000-8000-000000000001',clock_timestamp()),
 ('buyer-2','buyer2@fictional.test','repreneur','13600000-0000-4000-8000-000000000002',clock_timestamp()),
 ('buyer-3','buyer3@fictional.test','repreneur','13600000-0000-4000-8000-000000000003',clock_timestamp()),
 ('buyer-4','buyer4@fictional.test','repreneur','13600000-0000-4000-8000-000000000004',clock_timestamp()),
 ('buyer-5','buyer5@fictional.test','repreneur','13600000-0000-4000-8000-000000000005',clock_timestamp()),
 ('buyer-6','no-credential@fictional.test','repreneur','13600000-0000-4000-8000-000000000006',clock_timestamp());
DO $$ BEGIN
  IF NOT public.d136_recipient_ready('13600000-0000-4000-8000-000000000001')
    OR public.d136_recipient_ready('13600000-0000-4000-8000-000000000006') THEN
    RAISE EXCEPTION 'canonical credential recipient gate failed'; END IF;
  INSERT INTO public.app_user_roles(email,role) VALUES('BUYER1@FICTIONAL.TEST','staff');
  IF public.d136_recipient_ready('13600000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'case-folded staff conflict admitted'; END IF;
  DELETE FROM public.app_user_roles WHERE email='BUYER1@FICTIONAL.TEST';
END $$;

-- Controlled clock shift for a completed first window. No production clock
-- override exists; the update trigger is disabled only inside this fixture.
UPDATE public.discovery_digest_epochs SET activated_at=clock_timestamp()-interval '4 days'
WHERE deactivated_at IS NULL;
ALTER TABLE public.discovery_digest_first_availability DISABLE TRIGGER d136_first_event_immutable;
UPDATE public.discovery_digest_first_availability SET available_at=clock_timestamp()-interval '2 days'
WHERE epoch_id IS NOT NULL;
ALTER TABLE public.discovery_digest_first_availability ENABLE TRIGGER d136_first_event_immutable;
SELECT public.d136_materialize_next_window();
DO $$ BEGIN
  IF (SELECT status FROM public.discovery_digest_windows LIMIT 1)<>'ready'
    OR (SELECT item_count FROM public.discovery_digest_windows LIMIT 1)<>2
    OR (SELECT recipient_count FROM public.discovery_digest_windows LIMIT 1)<>5
    OR (SELECT count(*) FROM public.discovery_digest_deliveries)<>5
    OR (SELECT next_window_index FROM public.discovery_digest_epochs WHERE deactivated_at IS NULL)<>1
    OR (public.d136_materialize_next_window()->>'status')<>'not_due' THEN
    RAISE EXCEPTION 'complete fixed window or full recipient membership failed'; END IF;
END $$;

-- A claimed item cannot be claimed by another session. A lost response after
-- begin is receipt-only until manual review, never a new provider operation.
DO $$ DECLARE d uuid; c jsonb; token uuid; result jsonb; reconciliation text; BEGIN
  SELECT id INTO d FROM public.discovery_digest_deliveries
    WHERE repreneur_id='13600000-0000-4000-8000-000000000001';
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  IF c->>'status'<>'claimed' OR public.d136_claim(d)->>'status'<>'busy' THEN
    RAISE EXCEPTION 'duplicate claim was not fenced'; END IF;
  IF NOT public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload') THEN
    RAISE EXCEPTION 'valid provider begin failed'; END IF;
  UPDATE public.discovery_digest_deliveries SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=d;
  result:=public.d136_claim(d);
  IF result->>'status'<>'uncertain' THEN RAISE EXCEPTION 'lost response retried before 23h'; END IF;
  UPDATE public.discovery_digest_deliveries SET provider_started_at=clock_timestamp()-interval '24 hours' WHERE id=d;
  result:=public.d136_claim(d);
  IF result->>'status'<>'review_required' THEN RAISE EXCEPTION '23h review fence missing'; END IF;
  BEGIN
    PERFORM public.d136_reconcile(d,'staff-d136',NULL,true,NULL);
    RAISE EXCEPTION 'conclusive rejection without evidence accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='conclusive rejection without evidence accepted' THEN RAISE; END IF;
  END;
  reconciliation:=public.d136_reconcile(d,'staff-d136','fictional-provider-receipt',false,NULL);
  IF reconciliation<>'sent' OR (SELECT attempt_count FROM public.discovery_digest_deliveries WHERE id=d)<>1
    OR NOT EXISTS(SELECT 1 FROM public.discovery_digest_reconciliations
      WHERE delivery_id=d AND attempt_no=1 AND actor='staff-d136'
        AND decision='accepted' AND provider_message_id='fictional-provider-receipt')
    OR NOT EXISTS(SELECT 1 FROM public.discovery_digest_attempts
      WHERE delivery_id=d AND attempt_no=1 AND outcome='accepted'
        AND provider_started_at IS NOT NULL AND resolved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'receipt reconciliation failed: count %, audit %, outcome %, started %, resolved %',
      (SELECT attempt_count FROM public.discovery_digest_deliveries WHERE id=d),
      (SELECT count(*) FROM public.discovery_digest_reconciliations WHERE delivery_id=d),
      (SELECT outcome FROM public.discovery_digest_attempts WHERE delivery_id=d AND attempt_no=1),
      (SELECT provider_started_at IS NOT NULL FROM public.discovery_digest_attempts WHERE delivery_id=d AND attempt_no=1),
      (SELECT resolved_at IS NOT NULL FROM public.discovery_digest_attempts WHERE delivery_id=d AND attempt_no=1);
  END IF;
END $$;
DO $$ DECLARE d uuid; c jsonb; token uuid; began boolean; BEGIN
  SELECT id INTO d FROM public.discovery_digest_deliveries
    WHERE repreneur_id='13600000-0000-4000-8000-000000000002';
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  UPDATE public.repreneurs SET marketing_consent=false
    WHERE id='13600000-0000-4000-8000-000000000002';
  began:=public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload');
  IF began OR (SELECT status FROM public.discovery_digest_deliveries WHERE id=d)<>'suppressed' THEN
    RAISE EXCEPTION 'consent withdrawal before I/O not fenced: began %, ready %, status %',
      began,public.d136_recipient_ready('13600000-0000-4000-8000-000000000002'),
      (SELECT status FROM public.discovery_digest_deliveries WHERE id=d); END IF;
END $$;
DO $$ DECLARE d uuid; c jsonb; token uuid; first_outcome text; second_outcome text; BEGIN
  SELECT id INTO d FROM public.discovery_digest_deliveries
    WHERE repreneur_id='13600000-0000-4000-8000-000000000003';
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  IF NOT public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload') THEN
    RAISE EXCEPTION 'first provider begin failed'; END IF;
  first_outcome:=public.d136_complete(d,token,'rejected');
  IF first_outcome<>'failed' THEN
    RAISE EXCEPTION 'conclusive provider rejection not recorded'; END IF;
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  IF c->>'status'<>'claimed' OR NOT public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload') THEN
    RAISE EXCEPTION 'safe retry could not begin'; END IF;
  second_outcome:=public.d136_complete(d,token,'accepted','fictional-retry-receipt');
  IF second_outcome<>'sent' OR (SELECT attempt_count FROM public.discovery_digest_deliveries WHERE id=d)<>2
    OR (SELECT count(*) FROM public.discovery_digest_attempts WHERE delivery_id=d)<>2
    OR (SELECT outcome FROM public.discovery_digest_attempts
      WHERE delivery_id=d AND attempt_no=1)<>'rejected'
    OR (SELECT outcome FROM public.discovery_digest_attempts
      WHERE delivery_id=d AND attempt_no=2)<>'accepted' THEN
    RAISE EXCEPTION 'safe same-operation rejection retry failed'; END IF;
END $$;
DO $$ DECLARE d uuid; c jsonb; token uuid; BEGIN
  SELECT id INTO d FROM public.discovery_digest_deliveries
    WHERE repreneur_id='13600000-0000-4000-8000-000000000004';
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  PERFORM public.d136_opt_out('buyer-4');
  PERFORM public.d136_opt_out('buyer-4');
  IF (SELECT marketing_consent FROM public.repreneurs WHERE id='13600000-0000-4000-8000-000000000004') IS DISTINCT FROM true
    OR (SELECT count(*) FROM public.discovery_digest_optouts WHERE repreneur_id='13600000-0000-4000-8000-000000000004')<>1
    OR public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload') THEN
    RAISE EXCEPTION 'owner opt-out not one-way/idempotent or no-I/O'; END IF;
END $$;
DO $$ DECLARE d uuid; c jsonb; token uuid; opp uuid; BEGIN
  SELECT id INTO d FROM public.discovery_digest_deliveries
    WHERE repreneur_id='13600000-0000-4000-8000-000000000005';
  c:=public.d136_claim(d); token:=(c->>'leaseToken')::uuid;
  SELECT id INTO opp FROM public.opportunities WHERE reference='FIC-B';
  UPDATE public.opportunities SET public_title='Changed fictional title' WHERE id=opp;
  IF EXISTS(SELECT 1 FROM public.discovery_digest_copy_approvals WHERE opportunity_id=opp)
    OR public.d136_begin_provider_attempt(d,token,c->>'payloadSha256',c->'payload') THEN
    RAISE EXCEPTION 'copy withdrawal not invalidated/fenced'; END IF;
END $$;
DO $$ DECLARE opp uuid; BEGIN
  SELECT id INTO opp FROM public.opportunities WHERE reference='FIC-A';
  BEGIN
    DELETE FROM public.opportunities WHERE id=opp;
    RAISE EXCEPTION 'started opportunity deletion erased receipt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='started opportunity deletion erased receipt' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.repreneurs WHERE id='13600000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'started recipient deletion erased receipt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='started recipient deletion erased receipt' THEN RAISE; END IF;
  END;
END $$;
SELECT public.d136_toggle('staff-d136',false);
SELECT public.create_ordinary_discovery_opportunity(
  p_reference=>'FIC-OFF',p_target_status=>'active',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Off-period fictional","teaser_summary":"Safe off-period text"}'::jsonb);
DO $$ BEGIN
  IF (SELECT a.epoch_id FROM public.discovery_digest_first_availability a
    JOIN public.opportunities o ON o.id=a.opportunity_id WHERE o.reference='FIC-OFF') IS NOT NULL THEN
    RAISE EXCEPTION 'OFF first event assigned epoch'; END IF;
END $$;
SELECT public.d136_toggle('staff-d136',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.discovery_digest_epochs)<>2
    OR (SELECT count(*) FROM public.discovery_digest_first_availability a
      JOIN public.opportunities o ON o.id=a.opportunity_id
      WHERE o.reference IN ('FIC-PRE','FIC-OFF') AND a.epoch_id IS NOT NULL)<>0 THEN
    RAISE EXCEPTION 'reactivation replayed old or OFF event'; END IF;
END $$;

-- A second epoch supplies one fictional delivery for independent SQL sessions
-- to race on the same row in the surrounding shell rehearsal.
SELECT public.create_ordinary_discovery_opportunity(
  p_reference=>'FIC-RACE',p_target_status=>'active',p_actor=>'staff-d136',
  p_opportunity_fields=>' {"is_demo":false,"public_title":"Fictional race example","teaser_summary":"Only fictional public text."}'::jsonb);
UPDATE public.opportunities SET
  public_description_approved_hash=encode(sha256(convert_to(teaser_summary,'UTF8')),'hex'),
  public_description_approved_at=clock_timestamp(),public_description_approved_by='staff-d136'
WHERE reference='FIC-RACE';
SELECT public.d136_approve_copy(id,'staff-d136',public_title,teaser_summary)
FROM public.opportunities WHERE reference='FIC-RACE';
UPDATE public.discovery_digest_epochs SET activated_at=clock_timestamp()-interval '4 days'
WHERE deactivated_at IS NULL;
ALTER TABLE public.discovery_digest_first_availability DISABLE TRIGGER d136_first_event_immutable;
UPDATE public.discovery_digest_first_availability SET available_at=clock_timestamp()-interval '2 days'
WHERE opportunity_id=(SELECT id FROM public.opportunities WHERE reference='FIC-RACE');
ALTER TABLE public.discovery_digest_first_availability ENABLE TRIGGER d136_first_event_immutable;
DO $$ BEGIN
  IF public.d136_materialize_next_window()->>'status'<>'ready' THEN
    RAISE EXCEPTION 'second epoch fictional window not ready'; END IF;
  IF (SELECT count(*) FROM public.discovery_digest_deliveries d
    JOIN public.discovery_digest_windows w ON w.id=d.window_id
    JOIN public.discovery_digest_epochs e ON e.id=w.epoch_id
    WHERE e.deactivated_at IS NULL)<>3 THEN
    RAISE EXCEPTION 'second epoch eligible recipient count drifted'; END IF;
END $$;
