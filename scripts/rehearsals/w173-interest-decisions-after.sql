\set ON_ERROR_STOP on
-- All assertions are synthetic, transaction-scoped, and leave no local data.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_interest_events)
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries) THEN
    RAISE EXCEPTION 'w173_historical_replay';
  END IF;
  IF (SELECT count(*) FROM public.email_templates WHERE template_key IN
    ('interest_outcome_validated','interest_outcome_rejected','proposed_opportunity_response_staff')
    AND is_active=false AND body_editable=true) <> 3 THEN
    RAISE EXCEPTION 'w173_new_keys_not_inactive_editable';
  END IF;
  IF (SELECT subject FROM public.email_templates WHERE template_key='interest_outcome_validated')
    <>'Custom staff subject {opportunityTitle}' THEN
    RAISE EXCEPTION 'w173_staff_copy_override_lost';
  END IF;
END $$;

-- A proposed response while the key is inactive remains terminally suppressed
-- after staff later enables the key. A fresh later response is queued once.
SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000011','76000000-0000-4000-8000-000000000004','interested');
DO $$ DECLARE v_event UUID; BEGIN
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.match_id='76000000-0000-4000-8000-000000000011';
  IF v_event IS NULL OR (SELECT event_type FROM public.opportunity_interest_events WHERE id=v_event)<>'proposed_interested'
    OR (SELECT status FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event)<>'suppressed'
    OR (SELECT interest_expressed_at FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000011') IS NULL THEN
    RAISE EXCEPTION 'w173_exact_response_or_disabled_suppression_missing';
  END IF;
END $$;
UPDATE public.email_templates SET is_active=true
WHERE template_key IN ('interest_outcome_validated','interest_outcome_rejected','proposed_opportunity_response_staff');
INSERT INTO public.wave_journey_settings(singleton,enabled,updated_by) VALUES(true,true,'fixture')
ON CONFLICT(singleton) DO UPDATE SET enabled=true,updated_by='fixture';
DO $$ DECLARE v_event UUID; BEGIN
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.match_id='76000000-0000-4000-8000-000000000011';
  IF public.w173_claim_interest_delivery(v_event)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'w173_disabled_event_replayed';
  END IF;
END $$;
SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000014','76000000-0000-4000-8000-000000000007','declined');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.opportunity_interest_events
      WHERE match_id='76000000-0000-4000-8000-000000000014' AND event_type='proposed_declined')<>1
    OR (SELECT status FROM public.opportunity_interest_notification_deliveries d
      JOIN public.opportunity_interest_events e ON e.id=d.event_id
      WHERE e.match_id='76000000-0000-4000-8000-000000000014')<>'pending' THEN
    RAISE EXCEPTION 'w173_new_proposed_decline_not_queued';
  END IF;
END $$;

-- Staff rejection is private and exact; it neither changes this match status
-- nor affects the other repreneur/account/matches.
DO $$ DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID; BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000011';
  BEGIN
    PERFORM public.w173_reject_exact_interest(v_match.id,v_match.interest_expressed_at,v_match.updated_at,'w173-staff','  ');
    RAISE EXCEPTION 'w173_blank_reason_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'interest_rejection_reason_required' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w173_reject_exact_interest(v_match.id,v_match.interest_expressed_at,v_match.updated_at,'not-staff','Private reason');
    RAISE EXCEPTION 'w173_nonstaff_rejection_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'interest_rejection_staff_required' THEN RAISE; END IF;
  END;
  v_event:=public.w173_reject_exact_interest(v_match.id,v_match.interest_expressed_at,v_match.updated_at,
    'w173-staff','Confidential internal reason');
  IF (SELECT status FROM public.opportunity_matches WHERE id=v_match.id)<>'interested'
    OR (SELECT status FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000015')<>'proposed'
    OR (SELECT count(*) FROM public.w173_repreneur_rejections(v_match.repreneur_id,ARRAY[v_match.id]))<>1
    OR (SELECT reason FROM public.w173_staff_rejections('w173-staff',ARRAY[v_match.id]))<>'Confidential internal reason'
    OR public.w173_interest_delivery_payload(v_event)::TEXT ILIKE '%Confidential internal reason%'
    OR (SELECT body_markdown FROM public.email_templates WHERE template_key='interest_outcome_rejected') ILIKE '%Confidential internal reason%' THEN
    RAISE EXCEPTION 'w173_rejection_scope_or_privacy';
  END IF;
  BEGIN
    PERFORM public.journey_start_pursuit(v_match.id,'w173-staff','w173-rejected-validation');
    RAISE EXCEPTION 'w173_rejected_interest_validated';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'interest_rejected' THEN RAISE; END IF;
  END;
END $$;

-- Reconsideration from an unassigned interest never becomes a proposed
-- response merely because a prior match existed.
SELECT public.express_opportunity_interest(
  '76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000006','w173-repreneur',clock_timestamp());
SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000013','76000000-0000-4000-8000-000000000006','declined');
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.opportunity_interest_events
    WHERE match_id='76000000-0000-4000-8000-000000000013') THEN
    RAISE EXCEPTION 'w173_unassigned_interest_double_alert';
  END IF;
END $$;

-- The canonical staff validation path emits one event and must not be
-- bypassed by a stale idempotency key after drop/reopen.
DO $$ DECLARE v_match public.opportunity_matches%ROWTYPE; v_event UUID; BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000012';
  v_event:=public.w173_validate_exact_interest(v_match.id,v_match.opportunity_id,'w173-staff',
    NULL,v_match.updated_at,'w173-legacy-null-validation');
  IF v_event IS NULL OR (SELECT count(*) FROM public.opportunity_interest_events
    WHERE validation_evidence_id=v_event AND interest_expressed_at IS NULL)<>1 THEN
    RAISE EXCEPTION 'w173_legacy_null_interest_not_validated_exactly';
  END IF;
  PERFORM public.journey_transition_terminal(v_match.id,'drop','w173-staff','w173-legacy-drop','no_viable_match');
END $$;
SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000015','76000000-0000-4000-8000-000000000008','interested');
DO $$ DECLARE v_first UUID; v_second UUID; v_first_event UUID;
  v_a public.opportunity_matches%ROWTYPE; v_b public.opportunity_matches%ROWTYPE; BEGIN
  SELECT * INTO v_a FROM public.opportunity_matches WHERE id='76000000-0000-4000-8000-000000000015';
  PERFORM public.update_repreneur_opportunity_response(v_a.id,v_a.repreneur_id,'declined');
  PERFORM public.express_opportunity_interest(v_a.opportunity_id,v_a.repreneur_id,
    'w173-repreneur-second',v_a.interest_expressed_at+interval '1 second');
  SELECT * INTO v_b FROM public.opportunity_matches WHERE id=v_a.id;
  IF v_b.interest_expressed_at IS NOT DISTINCT FROM v_a.interest_expressed_at THEN
    RAISE EXCEPTION 'w173_reconsideration_did_not_change_exact_interest'; END IF;
  BEGIN
    PERFORM public.w173_revalidate_historical_pursuit(v_b.id,'w173-staff','w173-fresh-historical-bypass');
    RAISE EXCEPTION 'w173_fresh_interest_used_historical_route';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'historical_revalidation_requires_active_pursuit' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w173_validate_exact_interest(v_a.id,v_a.opportunity_id,'w173-staff',
      v_a.interest_expressed_at,v_a.updated_at,'w173-stale-validate-a');
    RAISE EXCEPTION 'w173_stale_a_validated_b';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'validation_interest_stale' THEN RAISE; END IF;
  END;
  v_first:=public.w173_validate_exact_interest(v_b.id,v_b.opportunity_id,'w173-staff',
    v_b.interest_expressed_at,v_b.updated_at,'w173-validation-first');
  IF v_first IS NULL OR (SELECT count(*) FROM public.opportunity_interest_events
    WHERE validation_evidence_id=v_first AND event_type='validated')<>1 THEN
    RAISE EXCEPTION 'w173_validation_event_missing';
  END IF;
  SELECT id INTO v_first_event FROM public.opportunity_interest_events WHERE validation_evidence_id=v_first;
  IF public.w173_validate_exact_interest(v_b.id,v_b.opportunity_id,'w173-staff',
    v_b.interest_expressed_at,v_b.updated_at,'w173-validation-first')<>v_first THEN
    RAISE EXCEPTION 'w173_same_cycle_validation_retry_not_idempotent';
  END IF;
  PERFORM public.journey_transition_terminal('76000000-0000-4000-8000-000000000015','drop',
    'w173-staff','w173-drop','no_viable_match');
  PERFORM public.journey_transition_terminal('76000000-0000-4000-8000-000000000015','reopen',
    'w173-staff','w173-reopen');
  BEGIN
    PERFORM public.journey_start_pursuit('76000000-0000-4000-8000-000000000015','w173-staff','w173-validation-first');
    RAISE EXCEPTION 'w173_stale_validation_key_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'validation_idempotency_stale' THEN RAISE; END IF;
  END;
  SELECT * INTO v_b FROM public.opportunity_matches WHERE id=v_b.id;
  v_second:=public.w173_validate_exact_interest(v_b.id,v_b.opportunity_id,'w173-staff',
    v_b.interest_expressed_at,v_b.updated_at,'w173-validation-second');
  IF v_second IS NULL OR v_second=v_first OR public.w173_interest_delivery_payload(v_first_event) IS NOT NULL THEN
    RAISE EXCEPTION 'w173_stale_validation_cycle_eligible';
  END IF;
END $$;

-- The generic sender may stop before provider I/O (e.g. daily cap). No
-- fingerprint or attempt timestamp is frozen then; after one uncertain
-- provider call, later no-I/O retries must preserve its original fence.
DO $$ DECLARE v_event UUID; v_claim JSONB; v_payload JSONB; v_attempted TIMESTAMPTZ; v_completed TEXT; BEGIN
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.event_type='validated' AND e.match_id='76000000-0000-4000-8000-000000000015'
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1;
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_completed:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'deferred');
  IF v_claim->>'status'<>'claimed' OR v_completed<>'deferred'
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries
      WHERE event_id=v_event AND (status<>'failed' OR payload_sha256 IS NOT NULL OR provider_attempted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'w173_first_no_provider_deferral_froze_payload event=%,claim=%,delivery=%',
      v_event,v_claim,(SELECT to_jsonb(d) FROM public.opportunity_interest_notification_deliveries d WHERE event_id=v_event);
  END IF;
  UPDATE public.email_templates SET body_markdown='Revised synthetic body {firstName}'
    WHERE template_key='interest_outcome_validated';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR v_payload->>'body'<>'Revised synthetic body {firstName}'
    OR NOT public.w173_begin_interest_provider_attempt(v_event,(v_claim->>'leaseToken')::UUID,repeat('d',64),v_payload)
    OR public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'uncertain')<>'uncertain' THEN
    RAISE EXCEPTION 'w173_current_copy_after_deferral_or_uncertain_missing';
  END IF;
  SELECT provider_attempted_at INTO v_attempted FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event;
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_completed:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'deferred');
  IF v_claim->>'status'<>'claimed' OR v_completed<>'deferred'
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries
      WHERE event_id=v_event AND (provider_outcome<>'uncertain' OR provider_attempted_at IS DISTINCT FROM v_attempted
        OR payload_sha256<>repeat('d',64))) THEN
    RAISE EXCEPTION 'w173_daily_cap_erased_prior_ambiguity';
  END IF;
  UPDATE public.opportunity_interest_notification_deliveries
    SET provider_attempted_at=clock_timestamp()-interval '24 hours' WHERE event_id=v_event;
  IF public.w173_claim_interest_delivery(v_event)->>'status'<>'review_required' THEN
    RAISE EXCEPTION 'w173_old_uncertain_provider_retried';
  END IF;
END $$;

DO $$ DECLARE v_event UUID; v_claim JSONB; v_completed TEXT; BEGIN
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.event_type='proposed_interested' AND e.match_id='76000000-0000-4000-8000-000000000015';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_completed:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'suppressed');
  IF v_claim->>'status'<>'claimed' OR v_completed<>'suppressed'
    OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries
      WHERE event_id=v_event AND (status<>'suppressed' OR provider_attempted_at IS NOT NULL OR payload_sha256 IS NOT NULL)) THEN
    RAISE EXCEPTION 'w173_staff_recipient_block_did_not_terminate_without_provider';
  END IF;
END $$;

-- A crashed provider call leaves 'attempting' behind its expired lease.
-- Recovery must convert it to sticky uncertainty before any new preflight
-- can defer, reject, or block a retry.
SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000016','76000000-0000-4000-8000-000000000009','interested');
DO $$ DECLARE v_event UUID; v_claim JSONB; v_payload JSONB; v_attempted TIMESTAMPTZ; v_complete TEXT; BEGIN
  SELECT id INTO v_event FROM public.opportunity_interest_events
    WHERE match_id='76000000-0000-4000-8000-000000000016' AND event_type='proposed_interested';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR NOT public.w173_begin_interest_provider_attempt(
    v_event,(v_claim->>'leaseToken')::UUID,repeat('e',64),v_payload) THEN
    RAISE EXCEPTION 'w173_crash_fixture_did_not_begin';
  END IF;
  SELECT provider_attempted_at INTO v_attempted FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event;
  UPDATE public.opportunity_interest_notification_deliveries SET lease_expires_at=clock_timestamp()-interval '1 second'
    WHERE event_id=v_event;
  v_claim:=public.w173_claim_interest_delivery(v_event);
  IF v_claim->>'status'<>'claimed' OR (SELECT provider_outcome FROM public.opportunity_interest_notification_deliveries
    WHERE event_id=v_event)<>'uncertain' THEN
    RAISE EXCEPTION 'w173_crashed_attempt_not_normalized';
  END IF;
  v_complete:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'deferred');
  IF v_complete<>'deferred' OR EXISTS(SELECT 1 FROM public.opportunity_interest_notification_deliveries
    WHERE event_id=v_event AND (provider_outcome<>'uncertain' OR provider_attempted_at IS DISTINCT FROM v_attempted
      OR payload_sha256<>repeat('e',64))) THEN
    RAISE EXCEPTION 'w173_crashed_attempt_erased_by_daily_cap';
  END IF;
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR NOT public.w173_begin_interest_provider_attempt(
    v_event,(v_claim->>'leaseToken')::UUID,repeat('e',64),v_payload) THEN
    RAISE EXCEPTION 'w173_same_key_safe_retry_missing';
  END IF;
  v_complete:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'rejected');
  IF v_complete<>'rejected' OR (SELECT provider_outcome FROM public.opportunity_interest_notification_deliveries
    WHERE event_id=v_event)<>'uncertain' THEN
    RAISE EXCEPTION 'w173_later_rejection_erased_earlier_ambiguity';
  END IF;
  UPDATE public.opportunity_interest_notification_deliveries
    SET provider_attempted_at=clock_timestamp()-interval '24 hours' WHERE event_id=v_event;
  IF public.w173_claim_interest_delivery(v_event)->>'status'<>'review_required' THEN
    RAISE EXCEPTION 'w173_crashed_provider_fence_lost_after_23h';
  END IF;
END $$;

SELECT public.update_repreneur_opportunity_response(
  '76000000-0000-4000-8000-000000000017','76000000-0000-4000-8000-000000000010','declined');
DO $$ DECLARE v_event UUID; v_claim JSONB; v_payload JSONB; v_completed TEXT; BEGIN
  SELECT id INTO v_event FROM public.opportunity_interest_events
    WHERE match_id='76000000-0000-4000-8000-000000000017' AND event_type='proposed_declined';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR NOT public.w173_begin_interest_provider_attempt(
    v_event,(v_claim->>'leaseToken')::UUID,repeat('f',64),v_payload) THEN
    RAISE EXCEPTION 'w173_blocked_after_crash_fixture_missing';
  END IF;
  UPDATE public.opportunity_interest_notification_deliveries SET lease_expires_at=clock_timestamp()-interval '1 second'
    WHERE event_id=v_event;
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_completed:=public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'suppressed');
  IF v_claim->>'status'<>'claimed' OR v_completed<>'review_required'
    OR (SELECT status FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event)<>'review_required' THEN
    RAISE EXCEPTION 'w173_block_after_crash_silenced_uncertainty';
  END IF;
END $$;

-- Staff routing is independent of the client mailbox and consent. Its
-- payload never carries private notes/source data. A fetched payload changed
-- before begin is durably quarantined, never sent to the stale envelope.
DO $$ DECLARE v_event UUID; v_claim JSONB; v_payload JSONB; v_began BOOLEAN; v_state TEXT; BEGIN
  UPDATE public.repreneurs SET email='invalid',marketing_consent=false
    WHERE id='76000000-0000-4000-8000-000000000007';
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.match_id='76000000-0000-4000-8000-000000000014' AND e.event_type='proposed_declined';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR v_payload IS NULL OR v_payload->>'recipientEmail'<>''
    OR v_payload::TEXT ILIKE '%PRIVATE SOURCE%' OR v_payload::TEXT ILIKE '%Confidential internal reason%' THEN
    RAISE EXCEPTION 'w173_staff_payload_depends_on_client_or_leaks';
  END IF;
  UPDATE public.opportunities SET public_title='New synthetic public title'
    WHERE id='76000000-0000-4000-8000-000000000003';
  v_began:=public.w173_begin_interest_provider_attempt(v_event,(v_claim->>'leaseToken')::UUID,repeat('a',64),v_payload);
  SELECT status INTO v_state FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event;
  IF v_began IS NOT FALSE OR v_state<>'review_required' THEN
    RAISE EXCEPTION 'w173_changed_payload_not_quarantined began=%,state=%,old=%,new=%',
      v_began,v_state,v_payload->>'opportunityTitle',public.w173_interest_delivery_payload(v_event)->>'opportunityTitle';
  END IF;
END $$;

-- An accepted begin followed by a conclusive rejection may retry only with
-- the same frozen digest. Changed canonical recipient/content requires review.
DO $$ DECLARE v_event UUID; v_claim JSONB; v_payload JSONB; v_began BOOLEAN; v_state TEXT; BEGIN
  SELECT e.id INTO v_event FROM public.opportunity_interest_events e
    WHERE e.match_id='76000000-0000-4000-8000-000000000011' AND e.event_type='rejected';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_payload:=public.w173_interest_delivery_payload(v_event);
  IF v_claim->>'status'<>'claimed' OR v_payload IS NULL
    OR v_payload::TEXT ILIKE '%Confidential internal reason%' THEN
    RAISE EXCEPTION 'w173_client_rejection_payload_missing_or_private';
  END IF;
  IF NOT public.w173_begin_interest_provider_attempt(v_event,(v_claim->>'leaseToken')::UUID,repeat('b',64),v_payload)
    OR public.w173_complete_interest_delivery(v_event,(v_claim->>'leaseToken')::UUID,'rejected')<>'rejected' THEN
    RAISE EXCEPTION 'w173_provider_rejection_retry_state';
  END IF;
  UPDATE public.repreneurs SET email='new-client@example.test'
    WHERE id='76000000-0000-4000-8000-000000000004';
  v_claim:=public.w173_claim_interest_delivery(v_event);
  v_began:=public.w173_begin_interest_provider_attempt(
    v_event,(v_claim->>'leaseToken')::UUID,repeat('c',64),public.w173_interest_delivery_payload(v_event));
  SELECT status INTO v_state FROM public.opportunity_interest_notification_deliveries WHERE event_id=v_event;
  IF v_claim->>'status'<>'claimed' OR v_began IS NOT FALSE OR v_state<>'review_required' THEN
    RAISE EXCEPTION 'w173_changed_frozen_recipient_retried claim=%,began=%,state=%',v_claim,v_began,v_state;
  END IF;
END $$;

DO $$ BEGIN
  IF has_table_privilege('anon','public.opportunity_interest_events','SELECT')
    OR has_table_privilege('authenticated','public.opportunity_interest_events','SELECT')
    OR has_table_privilege('service_role','public.opportunity_interest_events','UPDATE')
    OR has_table_privilege('anon','public.opportunity_interest_notification_deliveries','SELECT')
    OR has_function_privilege('anon','public.w173_staff_rejections(text,uuid[])','EXECUTE')
    OR has_function_privilege('authenticated','public.w173_reject_exact_interest(uuid,timestamptz,timestamptz,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'w173_private_role_boundary';
  END IF;
END $$;
ROLLBACK;
