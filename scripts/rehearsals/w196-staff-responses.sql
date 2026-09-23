\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE;
  v_opportunity public.opportunities%ROWTYPE;
  v_receipt jsonb;
  v_again jsonb;
BEGIN
  UPDATE public.email_templates SET is_active = true
    WHERE template_key = 'proposed_opportunity_response_staff';
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE id = '76000000-0000-4000-8000-000000000011';
  SELECT * INTO v_opportunity FROM public.opportunities WHERE id = v_match.opportunity_id;
  v_receipt := public.w196_record_staff_opportunity_response(
    v_match.repreneur_id, v_match.opportunity_id, v_match.id,
    v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
    'interested', '{}', NULL, 'w173-staff', 'w173-staff@example.test',
    '76000000-0000-4000-8000-000000000091');
  v_again := public.w196_record_staff_opportunity_response(
    v_match.repreneur_id, v_match.opportunity_id, v_match.id,
    v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
    'interested', '{}', NULL, 'w173-staff', 'w173-staff@example.test',
    '76000000-0000-4000-8000-000000000091');
  IF v_receipt->>'eventId' IS NULL
    OR v_again->>'eventId' IS DISTINCT FROM v_receipt->>'eventId'
    OR v_again->>'reusedExisting' <> 'true'
    OR (SELECT count(*) FROM public.staff_assisted_match_responses
      WHERE match_id = v_match.id AND origin = 'staff' AND staff_user_id = 'w173-staff') <> 1
    OR EXISTS (SELECT 1 FROM public.opportunity_interest_events WHERE match_id = v_match.id)
    OR EXISTS (SELECT 1 FROM public.opportunity_interest_notification_deliveries delivery
      JOIN public.opportunity_interest_events event_row ON event_row.id = delivery.event_id
      WHERE event_row.match_id = v_match.id)
  THEN RAISE EXCEPTION 'w196_staff_response_attribution_or_owner_email'; END IF;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      v_match.repreneur_id, v_match.opportunity_id, v_match.id,
      v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
      'declined', ARRAY['sector'], 'Changed intent', 'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000091');
    RAISE EXCEPTION 'w196_conflicting_retry_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_retry_conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      v_match.repreneur_id, v_match.opportunity_id, v_match.id,
      v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
      'interested', '{}', NULL, 'w173-staff', 'forged@example.test',
      '76000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'w196_forged_actor_email_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_denied' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      v_match.repreneur_id, v_match.opportunity_id, v_match.id,
      v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
      'declined', ARRAY['sector'], 'Changed intent', 'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000092');
    RAISE EXCEPTION 'w196_stale_match_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_stale_response' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      v_match.repreneur_id, v_match.opportunity_id, v_match.id,
      v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
      'interested', '{}', NULL, 'not-staff', 'not-staff@example.test',
      '76000000-0000-4000-8000-000000000093');
    RAISE EXCEPTION 'w196_nonstaff_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_denied' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.w196_record_staff_opportunity_response(
      '76000000-0000-4000-8000-000000000005', v_match.opportunity_id, v_match.id,
      v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
      'interested', '{}', NULL, 'w173-staff', 'w173-staff@example.test',
      '76000000-0000-4000-8000-000000000094');
    RAISE EXCEPTION 'w196_other_owner_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'staff_assistance_stale_response' THEN RAISE; END IF;
  END;
END $$;
DO $$
DECLARE
  v_match public.opportunity_matches%ROWTYPE;
  v_opportunity public.opportunities%ROWTYPE;
  v_cycle uuid;
  v_started timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_match FROM public.opportunity_matches
    WHERE id = '76000000-0000-4000-8000-000000000014';
  SELECT * INTO v_opportunity FROM public.opportunities WHERE id = v_match.opportunity_id;
  INSERT INTO public.opportunity_recommendation_cycles
    (match_id,opportunity_id,repreneur_id,source_kind,actor,started_at,expires_at)
  VALUES (v_match.id,v_match.opportunity_id,v_match.repreneur_id,
    'publication','w173-staff',v_started,v_started + interval '72 hours')
  RETURNING id INTO v_cycle;
  INSERT INTO public.opportunity_recommendation_cycle_deliveries
    (cycle_id,kind,due_at,template_key,status)
  VALUES
    (v_cycle,'client_reminder',v_started + interval '48 hours',
      'recommendation_response_reminder','pending'),
    (v_cycle,'staff_expiry',v_started + interval '72 hours',
      'recommendation_unanswered_staff_alert','pending');
  PERFORM public.w196_record_staff_opportunity_response(
    v_match.repreneur_id, v_match.opportunity_id, v_match.id,
    v_opportunity.updated_at, v_match.updated_at, v_match.interest_expressed_at,
    'declined', ARRAY['geography'], 'Outside target area', 'w173-staff', 'w173-staff@example.test',
    '76000000-0000-4000-8000-000000000095');
  IF (SELECT status FROM public.opportunity_matches WHERE id = v_match.id) <> 'declined'
    OR (SELECT staff_user_id FROM public.staff_assisted_match_responses WHERE match_id = v_match.id) <> 'w173-staff'
    OR EXISTS (SELECT 1 FROM public.opportunity_interest_events WHERE match_id = v_match.id)
    OR (SELECT count(*) FROM public.opportunity_recommendation_cycle_deliveries
      WHERE cycle_id = v_cycle AND status = 'suppressed') <> 2
  THEN RAISE EXCEPTION 'w196_staff_decline_or_notification'; END IF;
END $$;
DO $$ BEGIN
  IF has_table_privilege('anon', 'public.staff_assisted_match_responses', 'SELECT')
    OR has_table_privilege('authenticated', 'public.staff_assisted_match_responses', 'SELECT')
    OR has_table_privilege('service_role', 'public.staff_assisted_match_responses', 'INSERT')
    OR has_function_privilege('anon',
      'public.w196_record_staff_opportunity_response(uuid,uuid,uuid,timestamptz,timestamptz,timestamptz,text,text[],text,text,text,uuid)', 'EXECUTE')
  THEN RAISE EXCEPTION 'w196_response_acl'; END IF;
END $$;
ROLLBACK;
