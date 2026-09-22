-- Client mailbox changes cannot hide a configured-staff unanswered alert.
-- At expiry the client reminder is no longer claimable.
UPDATE public.repreneurs SET email='not-an-email',marketing_consent=false
  WHERE id='75000000-0000-4000-8000-000000000023';
DO $$
DECLARE v_cycle UUID; v_claim JSONB; v_payload JSONB;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000033';
  IF public.w175_cycle_delivery_payload(v_cycle,'client_reminder') IS NOT NULL THEN
    RAISE EXCEPTION 'expired client reminder remained eligible';
  END IF;
  v_payload:=public.w175_cycle_delivery_payload(v_cycle,'staff_expiry');
  IF v_payload IS NULL OR v_payload->>'recipientEmail'<>''
    OR v_payload->>'kind'<>'staff_expiry' THEN
    RAISE EXCEPTION 'staff expiry depended on client mailbox';
  END IF;
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'staff_expiry');
  IF v_claim->>'status'<>'claimed' THEN
    RAISE EXCEPTION 'staff expiry was not claimable: %',v_claim;
  END IF;
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'late client reminder did not suppress: %',v_claim;
  END IF;
END $$;

-- Lost portal entitlement permanently cancels a claimed but unbegun staff
-- alert; restoring a role cannot replay the old event.
DELETE FROM public.app_user_roles WHERE user_id='w175-staff-portal';
DO $$
DECLARE v_cycle UUID; v_claim JSONB;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000033';
  IF public.w175_cycle_delivery_payload(v_cycle,'staff_expiry') IS NOT NULL THEN
    RAISE EXCEPTION 'role loss left staff payload eligible';
  END IF;
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'staff_expiry');
  IF v_claim->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'role loss did not cancel old staff event: %',v_claim;
  END IF;
END $$;
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id)
VALUES('w175-staff-portal-restored','w175-restored@example.test','repreneur',
  '75000000-0000-4000-8000-000000000023');
DO $$
DECLARE v_cycle UUID;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000033';
  IF public.w175_claim_cycle_delivery(v_cycle,'staff_expiry')->>'status'<>'suppressed' THEN
    RAISE EXCEPTION 'role restoration revived an old staff event';
  END IF;
END $$;
