-- All rows here are disposable PG17-only synthetic data. No email is sent.
-- Test-only time travel preserves the 72-hour invariant while bypassing
-- capture/immutability triggers in this local cluster, never in production.
CREATE FUNCTION public.w175_test_age_match(p_match_id UUID,p_age INTERVAL)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_start TIMESTAMPTZ:=clock_timestamp()-p_age;
BEGIN
  PERFORM set_config('session_replication_role','replica',true);
  UPDATE public.opportunity_matches
    SET recommendation_published_at=v_start,
      recommendation_expires_at=v_start+INTERVAL '72 hours'
    WHERE id=p_match_id;
  UPDATE public.opportunity_recommendation_cycles
    SET started_at=v_start,expires_at=v_start+INTERVAL '72 hours'
    WHERE match_id=p_match_id;
  UPDATE public.opportunity_recommendation_cycle_deliveries d
    SET due_at=CASE WHEN d.kind='client_reminder'
      THEN v_start+INTERVAL '48 hours' ELSE v_start+INTERVAL '72 hours' END
    FROM public.opportunity_recommendation_cycles c
    WHERE c.id=d.cycle_id AND c.match_id=p_match_id;
  PERFORM set_config('session_replication_role','origin',true);
END $$;

INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo)
VALUES
 ('75000000-0000-4000-8000-000000000021','w175-known@example.test','Known','Outcome','fixture',false),
 ('75000000-0000-4000-8000-000000000022','w175-unknown@example.test','Unknown','Outcome','fixture',false),
 ('75000000-0000-4000-8000-000000000023','w175-expiry-person@example.test','Staff','Expiry','fixture',false),
 ('75000000-0000-4000-8000-000000000024','w175-copy@example.test','Copy','Edit','fixture',false);
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id)
VALUES
 ('w175-known-portal','w175-known@example.test','repreneur','75000000-0000-4000-8000-000000000021'),
 ('w175-unknown-portal','w175-unknown@example.test','repreneur','75000000-0000-4000-8000-000000000022'),
 ('w175-staff-portal','w175-expiry-person@example.test','repreneur','75000000-0000-4000-8000-000000000023'),
 ('w175-copy-portal','w175-copy@example.test','repreneur','75000000-0000-4000-8000-000000000024');
INSERT INTO public.opportunity_matches(id,opportunity_id,repreneur_id,status,created_by)
VALUES
 ('75000000-0000-4000-8000-000000000031','75000000-0000-4000-8000-000000000003',
  '75000000-0000-4000-8000-000000000021','proposed','w175-staff'),
 ('75000000-0000-4000-8000-000000000032','75000000-0000-4000-8000-000000000003',
  '75000000-0000-4000-8000-000000000022','proposed','w175-staff'),
 ('75000000-0000-4000-8000-000000000033','75000000-0000-4000-8000-000000000003',
  '75000000-0000-4000-8000-000000000023','proposed','w175-staff'),
 ('75000000-0000-4000-8000-000000000034','75000000-0000-4000-8000-000000000003',
  '75000000-0000-4000-8000-000000000024','proposed','w175-staff');
SELECT public.w175_test_age_match('75000000-0000-4000-8000-000000000031',INTERVAL '49 hours');
SELECT public.w175_test_age_match('75000000-0000-4000-8000-000000000032',INTERVAL '49 hours');
SELECT public.w175_test_age_match('75000000-0000-4000-8000-000000000033',INTERVAL '73 hours');
SELECT public.w175_test_age_match('75000000-0000-4000-8000-000000000034',INTERVAL '49 hours');

-- Staff copy can change between read and pre-provider fence. While current
-- eligibility remains valid, do not silently suppress a never-attempted event.
DO $$
DECLARE v_cycle UUID; v_claim JSONB; v_payload JSONB; v_token UUID;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000034';
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'claimed' THEN RAISE EXCEPTION 'copy-edit claim failed: %',v_claim; END IF;
  v_token:=(v_claim->>'leaseToken')::UUID;
  v_payload:=public.w175_cycle_delivery_payload(v_cycle,'client_reminder');
  UPDATE public.email_templates SET subject='Updated W175 copy — {opportunityTitle}'
    WHERE template_key='recommendation_response_reminder';
  IF public.w175_begin_cycle_provider_attempt(
      v_cycle,'client_reminder',v_token,repeat('c',64),v_payload) THEN
    RAISE EXCEPTION 'stale copy crossed provider boundary';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycle_deliveries
    WHERE cycle_id=v_cycle AND kind='client_reminder' AND status='review_required'
      AND provider_attempted_at IS NULL AND provider_inflight=false) THEN
    RAISE EXCEPTION 'pre-provider copy drift was silently suppressed or falsely attempted';
  END IF;
END $$;

-- A known provider rejection is retryable and does not become false
-- uncertainty. Once settled, ordinary match removal cascades the cycle.
DO $$
DECLARE v_cycle UUID; v_claim JSONB; v_payload JSONB; v_token UUID;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000031';
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'claimed' THEN RAISE EXCEPTION 'known client claim failed: %',v_claim; END IF;
  v_token:=(v_claim->>'leaseToken')::UUID;
  v_payload:=public.w175_cycle_delivery_payload(v_cycle,'client_reminder');
  IF v_payload IS NULL OR v_payload->>'recipientEmail'<>'w175-known@example.test'
    THEN RAISE EXCEPTION 'client payload is not exact and current'; END IF;
  IF NOT public.w175_begin_cycle_provider_attempt(
      v_cycle,'client_reminder',v_token,repeat('a',64),v_payload) THEN
    RAISE EXCEPTION 'known provider attempt was not fenced';
  END IF;
  IF public.w175_complete_cycle_delivery(
      v_cycle,'client_reminder',v_token,'rejected',NULL)<>'rejected' THEN
    RAISE EXCEPTION 'known provider rejection was not settled';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycle_deliveries
    WHERE cycle_id=v_cycle AND kind='client_reminder'
      AND status='failed' AND provider_outcome='rejected' AND provider_inflight=false) THEN
    RAISE EXCEPTION 'known rejection was falsely classified as uncertain';
  END IF;
  DELETE FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000031';
  IF EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycles WHERE id=v_cycle) THEN
    RAISE EXCEPTION 'settled match delete did not cascade its cycles';
  END IF;
END $$;

-- A genuinely unknown provider result is retained, not retried after 23h
-- and not erased by an otherwise supported match deletion.
DO $$
DECLARE v_cycle UUID; v_claim JSONB; v_payload JSONB; v_token UUID;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000032';
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'claimed' THEN RAISE EXCEPTION 'unknown client claim failed: %',v_claim; END IF;
  v_token:=(v_claim->>'leaseToken')::UUID;
  v_payload:=public.w175_cycle_delivery_payload(v_cycle,'client_reminder');
  IF NOT public.w175_begin_cycle_provider_attempt(
      v_cycle,'client_reminder',v_token,repeat('b',64),v_payload) THEN
    RAISE EXCEPTION 'unknown provider attempt did not begin';
  END IF;
  BEGIN
    DELETE FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000032';
    RAISE EXCEPTION 'in-flight provider evidence was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%recommendation_cycle_delivery_in_flight%' THEN RAISE; END IF;
  END;
  IF public.w175_complete_cycle_delivery(
      v_cycle,'client_reminder',v_token,'uncertain',NULL)<>'uncertain' THEN
    RAISE EXCEPTION 'unknown provider result was not retained';
  END IF;
  BEGIN
    DELETE FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000032';
    RAISE EXCEPTION 'unknown provider evidence was deleted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%recommendation_cycle_delivery_review_required%' THEN RAISE; END IF;
  END;
  UPDATE public.opportunity_recommendation_cycle_deliveries
    SET provider_attempted_at=clock_timestamp()-INTERVAL '24 hours'
    WHERE cycle_id=v_cycle AND kind='client_reminder';
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'review_required' THEN
    RAISE EXCEPTION 'old uncertain attempt was retried: %',v_claim;
  END IF;
END $$;
