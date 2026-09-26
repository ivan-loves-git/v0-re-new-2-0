\set ON_ERROR_STOP on
-- Dedicated disposable PostgreSQL fixture. All addresses use .test, and no
-- provider or project credentials are loaded by the rehearsal runner.
SET session_replication_role=replica;
INSERT INTO public.opportunities(id,reference,status,source_office_id,created_by,is_demo,public_title)
VALUES
('97000000-0000-4000-8000-000000000071','W192-1','active','76000000-0000-4000-8000-000000000002','fixture',false,'Withdrawal A'),
('97000000-0000-4000-8000-000000000072','W192-2','active','76000000-0000-4000-8000-000000000002','fixture',false,'Withdrawal B'),
('97000000-0000-4000-8000-000000000073','W192-3','active','76000000-0000-4000-8000-000000000002','fixture',false,'Withdrawal C'),
('97000000-0000-4000-8000-000000000074','W192-4','active','76000000-0000-4000-8000-000000000002','fixture',false,'Race withdrawal first'),
('97000000-0000-4000-8000-000000000075','W192-5','active','76000000-0000-4000-8000-000000000002','fixture',false,'Race validation first'),
('97000000-0000-4000-8000-000000000076','W192-6','active','76000000-0000-4000-8000-000000000002','fixture',false,'Namespace mismatch');
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo)
VALUES('97000000-0000-4000-8000-000000000066','w192-demo@example.test','Demo','Boundary','fixture',true);
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id)
VALUES('w192-demo','w192-demo@example.test','repreneur','97000000-0000-4000-8000-000000000066');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by,interest_expressed_at)
VALUES
('97000000-0000-4000-8000-000000000081','97000000-0000-4000-8000-000000000071','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('97000000-0000-4000-8000-000000000082','97000000-0000-4000-8000-000000000072','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('97000000-0000-4000-8000-000000000083','97000000-0000-4000-8000-000000000073','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('97000000-0000-4000-8000-000000000084','97000000-0000-4000-8000-000000000074','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('97000000-0000-4000-8000-000000000085','97000000-0000-4000-8000-000000000075','76000000-0000-4000-8000-000000000004','proposed','w173-staff',NULL),
('97000000-0000-4000-8000-000000000086','97000000-0000-4000-8000-000000000076','97000000-0000-4000-8000-000000000066','interested','fixture',clock_timestamp());
RESET session_replication_role;

INSERT INTO public.repreneur_opportunity_review_state(repreneur_id,opportunity_id,is_demo,reviewed)
VALUES('76000000-0000-4000-8000-000000000004','97000000-0000-4000-8000-000000000071',false,true);
UPDATE public.email_templates SET is_active=true WHERE template_key='proposed_opportunity_response_staff';
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(true,true,'fixture')
ON CONFLICT(singleton) DO UPDATE SET enabled=true,updated_by='fixture';
SELECT public.update_repreneur_opportunity_response(id,repreneur_id,'interested')
FROM public.opportunity_matches WHERE id IN (
  '97000000-0000-4000-8000-000000000081',
  '97000000-0000-4000-8000-000000000082',
  '97000000-0000-4000-8000-000000000083',
  '97000000-0000-4000-8000-000000000084',
  '97000000-0000-4000-8000-000000000085');

DO $$ DECLARE v_match public.opportunity_matches%ROWTYPE;
  v_event UUID; v_alert UUID; v_first JSONB; v_new public.opportunity_matches%ROWTYPE;
BEGIN
  IF has_function_privilege('anon','public.w192_withdraw_exact_interest(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,uuid,uuid)','EXECUTE')
    OR has_table_privilege('authenticated','public.opportunity_interest_direct_notices','SELECT')
  THEN RAISE EXCEPTION 'w192_browser_privilege'; END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000081';
  SELECT e.id INTO v_alert FROM public.opportunity_interest_events e
    WHERE e.match_id=v_match.id AND e.event_type='proposed_interested';
  IF v_alert IS NULL OR public.w173_interest_delivery_payload(v_alert) IS NULL
  THEN RAISE EXCEPTION 'w192_prewithdrawal_proposed_notice_missing'; END IF;
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
      'w173-repreneur-second','second@example.test',v_match.interest_expressed_at,v_match.updated_at,'Wrong owner');
    RAISE EXCEPTION 'w192_wrong_owner_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'withdrawal_actor_denied' THEN RAISE; END IF;
  END;
  v_first:=public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
    'w173-repreneur-interest','interested@example.test',v_match.interest_expressed_at,v_match.updated_at,'Expressed by mistake');
  v_event:=(v_first->>'eventId')::uuid;
  IF v_first->>'status'<>'withdrawn' OR v_first->>'reusedExisting'<>'false'
    OR (SELECT status FROM public.opportunity_matches WHERE id=v_match.id)<>'withdrawn'
    OR (SELECT count(*) FROM public.opportunity_interest_events e
      WHERE e.match_id=v_match.id AND e.event_type='withdrawn'
        AND e.id=v_event AND e.interest_expressed_at=v_match.interest_expressed_at
        AND e.match_updated_at=v_match.updated_at AND e.actor='w173-repreneur-interest'
        AND e.internal_reason='Expressed by mistake' AND e.withdrawal_origin='owner')<>1
    OR (SELECT status FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_alert)<>'suppressed'
    OR (SELECT count(*) FROM public.opportunity_interest_notification_deliveries d
      JOIN public.opportunity_interest_events e ON e.id=d.event_id
      WHERE e.match_id=v_match.id)<>1
    OR (SELECT reviewed FROM public.repreneur_opportunity_review_state
      WHERE repreneur_id=v_match.repreneur_id AND opportunity_id=v_match.opportunity_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'w192_owner_withdrawal_history_or_suppression'; END IF;
  IF public.w173_interest_delivery_payload(v_alert) IS NOT NULL
    OR public.w173_claim_interest_delivery(v_alert)->>'status'<>'suppressed'
    OR public.w192_begin_direct_interest_notice(v_match.id,v_match.interest_expressed_at)
    OR public.journey_repreneur_can_access_confidential(v_match.id,v_match.repreneur_id,
      '97000000-0000-4000-8000-000000000099')
  THEN RAISE EXCEPTION 'w192_old_work_or_access_reactivated'; END IF;
  IF public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
    'w173-repreneur-interest','interested@example.test',v_match.interest_expressed_at,v_match.updated_at,'Expressed by mistake')->>'eventId'<>v_event::text
  THEN RAISE EXCEPTION 'w192_retry_not_idempotent'; END IF;
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
      'w173-repreneur-interest','interested@example.test',v_match.interest_expressed_at,v_match.updated_at,'Different reason');
    RAISE EXCEPTION 'w192_changed_retry_misattributed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'withdrawal_interest_stale' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w173_validate_exact_interest(v_match.id,v_match.opportunity_id,'w173-staff',
      v_match.interest_expressed_at,v_match.updated_at,'w192-old-validation');
    RAISE EXCEPTION 'w192_old_validation_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'validation_interest_stale' THEN RAISE; END IF;
  END;
  SELECT * INTO v_new FROM public.opportunity_matches WHERE id=v_match.id;
  BEGIN
    PERFORM public.journey_start_pursuit(v_match.id,'w173-staff','w192-old-journey');
    RAISE EXCEPTION 'w192_old_journey_started';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Only an interested match can start a pursuit.' THEN RAISE; END IF;
  END;
  PERFORM public.express_opportunity_interest(v_match.opportunity_id,v_match.repreneur_id,
    'w173-repreneur-interest',v_match.interest_expressed_at);
  SELECT * INTO v_new FROM public.opportunity_matches WHERE id=v_match.id;
  IF v_new.status<>'interested' OR v_new.interest_expressed_at<=v_match.interest_expressed_at
    OR date_trunc('milliseconds',v_new.interest_expressed_at)<=date_trunc('milliseconds',v_match.interest_expressed_at)
    OR v_new.interest_notification_sent_at IS NOT NULL
    OR public.w173_interest_delivery_payload(v_alert) IS NOT NULL
  THEN RAISE EXCEPTION 'w192_fresh_interest_token_or_notice_revival'; END IF;
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
      'w173-repreneur-interest','interested@example.test',v_match.interest_expressed_at,v_match.updated_at,'Stale retry');
    RAISE EXCEPTION 'w192_old_withdrawal_cancelled_fresh';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'withdrawal_interest_stale' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.journey_start_pursuit(v_match.id,'w173-staff','w192-old-journey-after-fresh');
    RAISE EXCEPTION 'w192_generic_journey_started_after_fresh';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'validation_requires_exact_interest' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w173_validate_exact_interest(v_match.id,v_match.opportunity_id,'w173-staff',
      v_match.interest_expressed_at,v_match.updated_at,'w192-old-validation-after-fresh');
    RAISE EXCEPTION 'w192_old_validation_accepted_after_fresh';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'validation_interest_stale' THEN RAISE; END IF;
  END;
  PERFORM public.w173_validate_exact_interest(v_new.id,v_new.opportunity_id,'w173-staff',
    v_new.interest_expressed_at,v_new.updated_at,'w192-fresh-validation');
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(v_new.id,v_new.opportunity_id,v_new.repreneur_id,
      'w173-repreneur-interest','interested@example.test',v_new.interest_expressed_at,v_new.updated_at,'Too late');
    RAISE EXCEPTION 'w192_validated_interest_withdrawn';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'withdrawal_requires_staff_drop' THEN RAISE; END IF;
  END;
END $$;

DO $$ DECLARE v_match public.opportunity_matches%ROWTYPE; v_alert UUID;
  v_claim JSONB; v_payload JSONB;
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000082';
  SELECT id INTO v_alert FROM public.opportunity_interest_events
    WHERE match_id=v_match.id AND event_type='proposed_interested';
  v_claim:=public.w173_claim_interest_delivery(v_alert);
  v_payload:=public.w173_interest_delivery_payload(v_alert);
  IF v_claim->>'status'<>'claimed' OR NOT public.w173_begin_interest_provider_attempt(
    v_alert,(v_claim->>'leaseToken')::uuid,repeat('a',64),v_payload)
    OR NOT public.w192_begin_direct_interest_notice(v_match.id,v_match.interest_expressed_at)
  THEN RAISE EXCEPTION 'w192_provider_attempt_setup'; END IF;
  IF public.w192_begin_direct_interest_notice(v_match.id,v_match.interest_expressed_at)
  THEN RAISE EXCEPTION 'w192_duplicate_direct_provider_attempt'; END IF;
  PERFORM public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
    'w173-repreneur-interest','interested@example.test',v_match.interest_expressed_at,v_match.updated_at,'Stop future work');
  IF (SELECT status FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_alert)<>'pending'
    OR (SELECT provider_outcome FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_alert)<>'attempting'
    OR (SELECT status FROM public.opportunity_interest_direct_notices
      WHERE match_id=v_match.id AND interest_expressed_at=v_match.interest_expressed_at)<>'attempting'
    OR public.w192_begin_direct_interest_notice(v_match.id,v_match.interest_expressed_at)
  THEN RAISE EXCEPTION 'w192_inflight_provider_truth_erased'; END IF;
  IF public.w173_complete_interest_delivery(v_alert,(v_claim->>'leaseToken')::uuid,'sent','synthetic-receipt')<>'sent'
    OR public.w192_complete_direct_interest_notice(v_match.id,v_match.interest_expressed_at,'uncertain')<>'uncertain'
  THEN RAISE EXCEPTION 'w192_provider_reconciliation_failed'; END IF;
  IF (SELECT status FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_alert)<>'sent'
    OR (SELECT status FROM public.opportunity_interest_direct_notices
      WHERE match_id=v_match.id AND interest_expressed_at=v_match.interest_expressed_at)<>'uncertain'
  THEN RAISE EXCEPTION 'w192_sent_or_uncertain_truth_lost'; END IF;
END $$;

DO $$ DECLARE v_match public.opportunity_matches%ROWTYPE; v_result JSONB;
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000083';
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
      'w173-staff','w173-staff@example.test',v_match.interest_expressed_at,v_match.updated_at,
      'Repreneur requested removal','76000000-0000-4000-8000-000000000090',
      '76000000-0000-4000-8000-000000000087');
    RAISE EXCEPTION 'w192_stale_workspace_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'staff_portal_selection_changed' THEN RAISE; END IF;
  END;
  v_result:=public.w192_withdraw_exact_interest(v_match.id,v_match.opportunity_id,v_match.repreneur_id,
    'w173-staff','w173-staff@example.test',v_match.interest_expressed_at,v_match.updated_at,
    'Repreneur requested removal','76000000-0000-4000-8000-000000000090',
    '76000000-0000-4000-8000-000000000089');
  IF v_result->>'status'<>'withdrawn' OR NOT EXISTS(
    SELECT 1 FROM public.opportunity_interest_events WHERE id=(v_result->>'eventId')::uuid
      AND withdrawal_origin='staff' AND actor='w173-staff'
      AND internal_reason='Repreneur requested removal')
    OR NOT EXISTS(SELECT 1 FROM public.w192_staff_withdrawals('w173-staff',ARRAY[v_match.id])
      WHERE reason='Repreneur requested removal' AND actor='w173-staff' AND origin='staff')
  THEN RAISE EXCEPTION 'w192_staff_attribution_missing'; END IF;
  BEGIN
    PERFORM * FROM public.w192_staff_withdrawals('w173-repreneur-interest',ARRAY[v_match.id]);
    RAISE EXCEPTION 'w192_private_reason_exposed_to_owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'staff_required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w192_withdraw_exact_interest(
      '97000000-0000-4000-8000-000000000086','97000000-0000-4000-8000-000000000076',
      '97000000-0000-4000-8000-000000000066','w192-demo','w192-demo@example.test',
      (SELECT interest_expressed_at FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000086'),
      (SELECT updated_at FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000086'),
      'Wrong namespace');
    RAISE EXCEPTION 'w192_namespace_mismatch_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'withdrawal_interest_stale' THEN RAISE; END IF;
  END;
END $$;

DO $$ DECLARE v_event UUID;
BEGIN
  SELECT id INTO v_event FROM public.opportunity_interest_events
    WHERE match_id='97000000-0000-4000-8000-000000000083' AND event_type='withdrawn';
  BEGIN
    DELETE FROM public.opportunity_interest_events WHERE id=v_event;
    RAISE EXCEPTION 'w192_direct_history_deletion_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'interest_event_history_immutable' THEN RAISE; END IF;
  END;
  DELETE FROM public.opportunity_matches WHERE id='97000000-0000-4000-8000-000000000083';
  IF EXISTS(SELECT 1 FROM public.opportunity_interest_events WHERE id=v_event)
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries d
      JOIN public.opportunity_interest_events e ON e.id=d.event_id
      WHERE e.match_id='97000000-0000-4000-8000-000000000083')
  THEN RAISE EXCEPTION 'w192_parent_retention_cascade_failed'; END IF;
END $$;
