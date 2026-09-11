\set ON_ERROR_STOP on
-- Local synthetic database only; no provider or production data.
BEGIN;
SET session_replication_role=replica;
INSERT INTO public.ma_firms(id,name,status,created_by) VALUES
('75000000-0000-4000-8000-000000000001','W175 synthetic firm','active','fixture');
INSERT INTO public.ma_offices(id,firm_id,name,status,is_default,created_by) VALUES
('75000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000001','W175 synthetic office','active',true,'fixture');
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title,teaser_summary,description) VALUES
('75000000-0000-4000-8000-000000000003','W175-REAL','active','75000000-0000-4000-8000-000000000002','fixture',false,'Public title','Approved teaser','INTERNAL NEVER EMAIL');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES
('75000000-0000-4000-8000-000000000004','  W175@example.test  ','Synthetic','Person','fixture',false),
('75000000-0000-4000-8000-000000000005','w175-history@example.test','Historical','Person','fixture',false);
INSERT INTO public.app_user_roles(user_id,email,role) VALUES ('w175-staff','w175-staff@example.test','staff');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
('75000000-0000-4000-8000-000000000006','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000005','proposed','legacy');
RESET session_replication_role;

-- Installing the migration never backfills the historical recommendation.
\ir ../../supabase/migrations/20260911180000_w175_recommendation_assignment_notification.sql
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_recommendation_assignment_notifications) THEN
    RAISE EXCEPTION 'w175_historical_notification_created';
  END IF;
END $$;

INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
('75000000-0000-4000-8000-000000000007','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000004','proposed','w175-staff');
DO $$ DECLARE v_payload jsonb; BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) <> 1 THEN
    RAISE EXCEPTION 'w175_new_assignment_notification_missing';
  END IF;
  SELECT public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') INTO v_payload;
  IF v_payload->>'recipient_email' <> 'w175@example.test' OR v_payload->>'public_title' <> 'Public title'
    OR v_payload->>'teaser_summary' <> 'Approved teaser' OR v_payload::text LIKE '%INTERNAL%' THEN
    RAISE EXCEPTION 'w175_snapshot_projection_invalid';
  END IF;
  IF EXISTS(SELECT 1 FROM public.app_user_roles WHERE repreneur_id='75000000-0000-4000-8000-000000000004')
    OR EXISTS(SELECT 1 FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000007'
      AND (recommendation_published_at IS NOT NULL OR recommendation_expires_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'w175_assignment_created_access_or_clock';
  END IF;
END $$;
-- A note, renewal or a repeated Proposed status cannot create another intent.
UPDATE public.opportunity_matches SET human_notes='private staff note',status='proposed'
WHERE id='75000000-0000-4000-8000-000000000007';
UPDATE public.opportunity_matches SET human_notes='historical note',status='proposed'
WHERE id='75000000-0000-4000-8000-000000000006';
DO $$ DECLARE v_id UUID; BEGIN
  SELECT id INTO v_id FROM public.opportunity_recommendation_assignment_notifications;
  IF v_id IS NULL OR (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) <> 1 THEN
    RAISE EXCEPTION 'w175_note_or_historical_send';
  END IF;
  SET LOCAL ROLE service_role;
  IF (SELECT status FROM public.list_recommendation_assignment_notification_states(ARRAY['75000000-0000-4000-8000-000000000007']::UUID[],'w175-staff')) <> 'pending' THEN
    RAISE EXCEPTION 'w175_pending_readback_wrong';
  END IF;
  IF (public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff')->>'id')::UUID <> v_id THEN
    RAISE EXCEPTION 'w175_retry_changed_identity';
  END IF;
  BEGIN
    UPDATE public.opportunity_recommendation_assignment_notifications SET public_title='tamper' WHERE id=v_id;
    RAISE EXCEPTION 'w175_service_mutation_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.opportunity_recommendation_assignment_notifications(match_id,created_by,recipient_email,recipient_first_name,public_title)
    VALUES('75000000-0000-4000-8000-000000000006','w175-staff','arbitrary@example.test','X','X');
    RAISE EXCEPTION 'w175_service_historical_intent_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.opportunity_recommendation_assignment_notifications SET public_title='tamper';
    RAISE EXCEPTION 'w175_snapshot_update_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'recommendation_assignment_snapshot_immutable' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','not-staff');
    RAISE EXCEPTION 'w175_nonstaff_payload_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'recommendation_assignment_staff_required' THEN RAISE; END IF;
  END;
  IF has_table_privilege('anon','public.opportunity_recommendation_assignment_notifications','SELECT')
    OR has_table_privilege('authenticated','public.opportunity_recommendation_assignment_notifications','SELECT')
    OR has_function_privilege('anon','public.get_recommendation_assignment_notification(uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.get_recommendation_assignment_notification(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.get_recommendation_assignment_notification(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'w175_browser_role_privileges';
  END IF;
END $$;

-- Every mutable disclosure condition is checked again, not inferred from the
-- fact that a snapshot exists. Keep all values synthetic.
DO $$ BEGIN
  UPDATE public.repreneurs SET email='changed@example.test' WHERE id='75000000-0000-4000-8000-000000000004';
  IF public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') IS NOT NULL THEN RAISE EXCEPTION 'w175_changed_recipient_allowed'; END IF;
  IF (SELECT status FROM public.list_recommendation_assignment_notification_states(ARRAY['75000000-0000-4000-8000-000000000007']::UUID[],'w175-staff')) <> 'blocked' THEN RAISE EXCEPTION 'w175_blocked_readback_wrong'; END IF;
  UPDATE public.repreneurs SET email='w175@example.test' WHERE id='75000000-0000-4000-8000-000000000004';
  UPDATE public.opportunities SET public_title='Changed public title' WHERE id='75000000-0000-4000-8000-000000000003';
  IF public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') IS NOT NULL THEN RAISE EXCEPTION 'w175_changed_title_allowed'; END IF;
  UPDATE public.opportunities SET public_title='Public title',teaser_summary='Changed approved teaser' WHERE id='75000000-0000-4000-8000-000000000003';
  IF public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') IS NOT NULL THEN RAISE EXCEPTION 'w175_changed_teaser_allowed'; END IF;
  UPDATE public.opportunities SET teaser_summary='Approved teaser',status='draft' WHERE id='75000000-0000-4000-8000-000000000003';
  IF public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') IS NOT NULL THEN RAISE EXCEPTION 'w175_inactive_opportunity_allowed'; END IF;
  UPDATE public.opportunities SET status='active' WHERE id='75000000-0000-4000-8000-000000000003';
  UPDATE public.opportunity_matches SET status='declined' WHERE id='75000000-0000-4000-8000-000000000007';
  IF public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000007','w175-staff') IS NOT NULL THEN RAISE EXCEPTION 'w175_declined_assignment_allowed'; END IF;
  UPDATE public.opportunity_matches SET status='proposed' WHERE id='75000000-0000-4000-8000-000000000007';
END $$;

DO $$ DECLARE v_key TEXT; BEGIN
  SELECT 'recommendation-assignment:'||id::TEXT INTO v_key FROM public.opportunity_recommendation_assignment_notifications
    WHERE match_id='75000000-0000-4000-8000-000000000007';
  INSERT INTO public.email_logs(repreneur_id,template_key,to_email,subject,status,idempotency_key,provider_outcome,provider_attempted_at)
  VALUES('75000000-0000-4000-8000-000000000004','opportunity_recommendation_assignment','w175@example.test','Synthetic subject','pending',v_key,'uncertain',clock_timestamp()-interval '25 hours');
  IF (SELECT status FROM public.list_recommendation_assignment_notification_states(ARRAY['75000000-0000-4000-8000-000000000007']::UUID[],'w175-staff')) <> 'review_required' THEN RAISE EXCEPTION 'w175_uncertain_readback_wrong'; END IF;
  UPDATE public.email_logs SET status='bounced',provider_outcome='accepted' WHERE idempotency_key=v_key;
  IF (SELECT status FROM public.list_recommendation_assignment_notification_states(ARRAY['75000000-0000-4000-8000-000000000007']::UUID[],'w175-staff')) <> 'delivery_issue' THEN RAISE EXCEPTION 'w175_bounce_reported_as_sent'; END IF;
  UPDATE public.email_logs SET status='sent' WHERE idempotency_key=v_key;
  IF (SELECT status FROM public.list_recommendation_assignment_notification_states(ARRAY['75000000-0000-4000-8000-000000000007']::UUID[],'w175-staff')) <> 'sent' THEN RAISE EXCEPTION 'w175_sent_readback_wrong'; END IF;
END $$;

SET session_replication_role=replica;
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title) VALUES
('75000000-0000-4000-8000-000000000008','W175-DEMO','active','75000000-0000-4000-8000-000000000002','fixture',true,'Synthetic DEMO');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo) VALUES
('75000000-0000-4000-8000-000000000009','w175-demo@example.test','Demo','Person','fixture',true),
('75000000-0000-4000-8000-000000000010','invalid','Invalid','Person','fixture',false),
('75000000-0000-4000-8000-000000000011','blocked@@example.test','Blocked','Person','fixture',false),
('75000000-0000-4000-8000-000000000012','w175-draft@example.test','Draft','Person','fixture',false),
('75000000-0000-4000-8000-000000000013','w175-safe@example.test','Safe','Person','fixture',false);
RESET session_replication_role;
SET LOCAL ROLE service_role;
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
('75000000-0000-4000-8000-000000000014','75000000-0000-4000-8000-000000000008','75000000-0000-4000-8000-000000000009','proposed','w175-staff'),
('75000000-0000-4000-8000-000000000015','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000012','draft','w175-staff');
UPDATE public.opportunity_matches SET status='proposed' WHERE id='75000000-0000-4000-8000-000000000015';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_assignment_notifications) <> 1
    OR public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000014','w175-staff') IS NOT NULL THEN
    RAISE EXCEPTION 'w175_demo_or_existing_status_send';
  END IF;
  BEGIN
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by)
    VALUES('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000010','proposed','w175-staff');
    RAISE EXCEPTION 'w175_invalid_recipient_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'recommendation_assignment_valid_email_required' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by)
    VALUES('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000011','proposed','w175-staff');
    RAISE EXCEPTION 'w175_invalid_domain_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'recommendation_assignment_valid_email_required' THEN RAISE; END IF;
  END;
END $$;

-- Direct database assignments enforce the same mailbox syntax as staff actions.
DO $$ DECLARE v_email TEXT; BEGIN
  FOREACH v_email IN ARRAY ARRAY[
    'missing..local@example.test','.local@example.test','local.@example.test',
    'local@-example.test','local@example-.test','local@example..test',
    'local@exam_ple.test','local@localhost','local name@example.test','local@','@example.test',
    repeat('a',65)||'@example.test','local@'||repeat('a',64)||'.test',
    'local@'||repeat(repeat('a',63)||'.',4)||'test'
  ] LOOP
    UPDATE public.repreneurs SET email=v_email WHERE id='75000000-0000-4000-8000-000000000011';
    BEGIN
      INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by)
      VALUES('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000011','proposed','w175-staff');
      RAISE EXCEPTION 'w175_malformed_mailbox_allowed';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'recommendation_assignment_valid_email_required' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

DO $$ DECLARE v_email TEXT; v_match UUID; BEGIN
  FOREACH v_email IN ARRAY ARRAY[
    'valid@example.test','x@y.z','first.last+tag@example.invalid',
    repeat('a',64)||'@example.test','local@'||repeat('a',63)||'.test'
  ] LOOP
    UPDATE public.repreneurs SET email=chr(11)||E' \t'||upper(v_email)||U&'\00A0'
      WHERE id='75000000-0000-4000-8000-000000000011';
    BEGIN
      INSERT INTO public.opportunity_matches(opportunity_id,repreneur_id,status,created_by)
      VALUES('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000011','proposed','w175-staff')
      RETURNING id INTO v_match;
      IF public.get_recommendation_assignment_notification(v_match,'w175-staff')->>'recipient_email' IS DISTINCT FROM v_email THEN
        RAISE EXCEPTION 'w175_valid_mailbox_normalization_mismatch';
      END IF;
      RAISE EXCEPTION 'w175_valid_mailbox_probe_rollback';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'w175_valid_mailbox_probe_rollback' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

UPDATE public.opportunities SET teaser_summary='Internal — Never EMAIL!' WHERE id='75000000-0000-4000-8000-000000000003';
SET LOCAL ROLE service_role;
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by) VALUES
('75000000-0000-4000-8000-000000000016','75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000013','proposed','w175-staff');
DO $$ DECLARE v_payload JSONB; BEGIN
  SELECT public.get_recommendation_assignment_notification('75000000-0000-4000-8000-000000000016','w175-staff') INTO v_payload;
  IF v_payload IS NULL OR v_payload->>'teaser_summary' IS NOT NULL OR v_payload::TEXT ILIKE '%never email%' THEN
    RAISE EXCEPTION 'w175_internal_description_echoed';
  END IF;
END $$;
-- Existing canonical deletion semantics also erase the frozen contact data.
DELETE FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000016';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_recommendation_assignment_notifications WHERE match_id='75000000-0000-4000-8000-000000000016') THEN
    RAISE EXCEPTION 'w175_parent_deletion_retained_recipient';
  END IF;
END $$;
RESET ROLE;
SELECT 'w175 snapshot, retry, disclosure, privilege, lifecycle and retention rehearsals passed' AS result;
ROLLBACK;
