-- Every current-entitlement loss is checked on a fresh, due exact grant.
-- SAVEPOINTs reset only this disposable fixture so each denial is independent.
BEGIN;
DO $$ DECLARE v_expiry TIMESTAMPTZ; v_grant UUID;
BEGIN
  SELECT nda_expires_at INTO v_expiry FROM public.opportunity_pursuit_confidential_grants
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','cancellation fixture','w174-revoke-for-cancellation');
  v_grant:=public.journey_grant_confidential_access(
    '74000000-0000-4000-8000-000000000007','74000000-0000-4000-8000-000000000009',
    'w174-staff','w174-cancellation-grant',v_expiry);
  UPDATE public.opportunity_memo_feedback_reminders SET due_at=clock_timestamp()-interval '1 second'
    WHERE grant_evidence_id=v_grant;
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NULL THEN
    RAISE EXCEPTION 'Fresh cancellation fixture has no eligible payload';
  END IF;
END $$;
SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  PERFORM public.journey_revoke_confidential_access('74000000-0000-4000-8000-000000000007',
    'w174-staff','revoke cancellation','w174-cancel-revoked');
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Revoked exact grant remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  -- Advance only the mutable entitlement clock in this disposable fixture;
  -- immutable grant evidence remains untouched.
  UPDATE public.opportunity_pursuit_confidential_grants
    SET nda_expires_at=clock_timestamp()-interval '1 second'
    WHERE match_id='74000000-0000-4000-8000-000000000007';
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Expired NDA grant remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  PERFORM public.journey_transition_terminal('74000000-0000-4000-8000-000000000007',
    'drop','w174-staff','w174-cancel-terminal','no_viable_match');
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Terminal pursuit remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  DELETE FROM public.app_user_roles WHERE user_id='w174-repreneur-real';
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Lost portal role remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  PERFORM public.pause_opportunity_with_reason('74000000-0000-4000-8000-000000000003',
    'paused_cabinet','w174-staff');
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Inactive opportunity remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  -- Namespace corruption is deliberately synthetic; business operations must
  -- never produce it. Re-enable all guards before exercising service RPCs.
  SET LOCAL session_replication_role=replica;
  UPDATE public.repreneurs SET is_demo=true WHERE id='74000000-0000-4000-8000-000000000005';
  SET LOCAL session_replication_role=origin;
  IF public.w174_memo_feedback_delivery_payload(v_grant) IS NOT NULL
    OR public.w174_claim_memo_feedback_reminder(v_grant)->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'Namespace mismatch remained sendable';
  END IF;
END $$;
ROLLBACK TO SAVEPOINT current_grant;

DO $$ DECLARE v_grant UUID; v_receipt UUID; v_denied BOOLEAN:=false;
BEGIN
  SELECT id INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE idempotency_key='w174-cancellation-grant';
  v_receipt:=public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',
    v_grant,'w174-staff','phone',clock_timestamp());
  IF v_receipt IS NULL THEN RAISE EXCEPTION 'Exact receipt fixture failed'; END IF;
  SET LOCAL session_replication_role=replica;
  UPDATE public.repreneurs SET is_demo=true WHERE id='74000000-0000-4000-8000-000000000005';
  SET LOCAL session_replication_role=origin;
  BEGIN
    PERFORM public.w174_record_memo_feedback('74000000-0000-4000-8000-000000000007',
      v_grant,'w174-staff','phone',(SELECT (metadata->>'received_at')::timestamptz
        FROM public.opportunity_pursuit_evidence WHERE id=v_receipt));
  EXCEPTION WHEN others THEN v_denied:=true; END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Namespace mismatch passed receipt replay';
  END IF;
END $$;
ROLLBACK;
