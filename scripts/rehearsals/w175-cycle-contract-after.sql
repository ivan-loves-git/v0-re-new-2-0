-- W175 contract assertions
DO $$
DECLARE v_start TIMESTAMPTZ:='2026-09-22 12:00:00+00';
  v_end TIMESTAMPTZ:='2026-09-25 12:00:00+00';
BEGIN
  IF public.w175_cycle_window_open('client_reminder',v_start,v_end,v_start+INTERVAL '47 hours 59 minutes 59 seconds')
    OR NOT public.w175_cycle_window_open('client_reminder',v_start,v_end,v_start+INTERVAL '48 hours')
    OR NOT public.w175_cycle_window_open('client_reminder',v_start,v_end,v_end-INTERVAL '1 microsecond')
    OR public.w175_cycle_window_open('client_reminder',v_start,v_end,v_end)
    OR public.w175_cycle_window_open('staff_expiry',v_start,v_end,v_end-INTERVAL '1 microsecond')
    OR NOT public.w175_cycle_window_open('staff_expiry',v_start,v_end,v_end)
    OR NOT public.w175_cycle_window_open('staff_expiry',v_start,v_end,v_end+INTERVAL '1 hour') THEN
    RAISE EXCEPTION '48/72 elapsed-hour boundary regression';
  END IF;
END $$;

-- W164 already forbids matched REAL/DEMO endpoint reclassification.
DO $$
BEGIN
  BEGIN
    UPDATE public.opportunities SET is_demo=true
      WHERE id='75000000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'matched opportunity namespace changed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%w164_matched_opportunity_reclassification_denied%'
      THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.repreneurs SET is_demo=true
      WHERE id='75000000-0000-4000-8000-000000000005';
    RAISE EXCEPTION 'matched repreneur namespace changed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%w164_matched_repreneur_reclassification_denied%'
      THEN RAISE; END IF;
  END;
END $$;

UPDATE public.opportunity_matches SET status='proposed',human_notes='Synthetic edit'
  WHERE id='75000000-0000-4000-8000-000000000011';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000011')<>1 THEN
    RAISE EXCEPTION 'routine status/notes edit minted a cycle';
  END IF;
END $$;

-- A status-away and return cannot revive old A under the retained W172 clock.
UPDATE public.opportunity_matches SET status='draft'
  WHERE id='75000000-0000-4000-8000-000000000012';
UPDATE public.opportunity_matches SET status='proposed'
  WHERE id='75000000-0000-4000-8000-000000000012';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000012')<>1
    OR (SELECT count(*) FROM public.opportunity_recommendation_cycle_deliveries d
      JOIN public.opportunity_recommendation_cycles c ON c.id=d.cycle_id
      WHERE c.match_id='75000000-0000-4000-8000-000000000012'
        AND d.status<>'suppressed')<>0 THEN
    RAISE EXCEPTION 'old cycle revived after Proposed return';
  END IF;
END $$;

-- Synthetic local time travel makes A expired so the canonical renewal RPC
-- can be exercised. No production clock is rewritten or backfilled.
BEGIN;
SET LOCAL session_replication_role=replica;
UPDATE public.opportunity_matches
  SET recommendation_expires_at=clock_timestamp()-INTERVAL '1 second'
  WHERE id='75000000-0000-4000-8000-000000000011';
COMMIT;
DO $$
DECLARE v_publication TIMESTAMPTZ;
BEGIN
  SELECT recommendation_published_at INTO v_publication
    FROM public.opportunity_matches WHERE id='75000000-0000-4000-8000-000000000011';
  PERFORM * FROM public.renew_opportunity_recommendation(
    '75000000-0000-4000-8000-000000000011','w175-renewer');
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000011')<>2
    OR NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycles
      WHERE match_id='75000000-0000-4000-8000-000000000011'
        AND source_kind='renewal' AND actor='w175-renewer')
    OR (SELECT recommendation_published_at FROM public.opportunity_matches
      WHERE id='75000000-0000-4000-8000-000000000011') IS DISTINCT FROM v_publication THEN
    RAISE EXCEPTION 'explicit renewal provenance or first publication changed';
  END IF;
  BEGIN
    UPDATE public.opportunity_matches
      SET recommendation_expires_at=recommendation_expires_at+INTERVAL '1 minute'
      WHERE id='75000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'renewal source flag leaked across statements';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%recommendation_clock_canonical_source_required%'
      THEN RAISE; END IF;
  END;
END $$;

-- The original first-publication and an open renewal remain single cycles;
-- enabling later never requeues initially inactive event intents.
UPDATE public.email_templates SET is_active=true
  WHERE template_key IN ('recommendation_response_reminder','recommendation_unanswered_staff_alert');
DO $$
DECLARE v_cycle UUID; v_claim JSONB;
BEGIN
  SELECT id INTO v_cycle FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000012';
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'client_reminder');
  IF v_claim->>'status'<>'suppressed' THEN RAISE EXCEPTION 'off-to-on replayed an old client job'; END IF;
  v_claim:=public.w175_claim_cycle_delivery(v_cycle,'staff_expiry');
  IF v_claim->>'status'<>'suppressed' THEN RAISE EXCEPTION 'off-to-on replayed an old staff job'; END IF;
  PERFORM * FROM public.renew_opportunity_recommendation(
    '75000000-0000-4000-8000-000000000011','w175-renewer');
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000011')<>2 THEN
    RAISE EXCEPTION 'open-window double-click minted another cycle';
  END IF;
END $$;

-- W164 permits same-namespace pair edits. A simultaneous unclocked
-- Draft-to-Proposed reassignment is a real W172 publication and needs one
-- event; a later pair-only change cancels that event without minting another.
INSERT INTO public.repreneurs(id,email,first_name,last_name,created_by,is_demo)
VALUES('75000000-0000-4000-8000-000000000041','w175-pair@example.test',
  'Pair','Fixture','fixture',false);
INSERT INTO public.app_user_roles(user_id,email,role,repreneur_id)
VALUES('w175-pair-portal','w175-pair@example.test','repreneur',
  '75000000-0000-4000-8000-000000000041');
UPDATE public.opportunity_matches SET status='draft'
  WHERE id='75000000-0000-4000-8000-000000000010';
UPDATE public.opportunity_matches
  SET repreneur_id='75000000-0000-4000-8000-000000000041',status='proposed'
  WHERE id='75000000-0000-4000-8000-000000000010';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000010')<>1
    OR NOT EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycles
      WHERE match_id='75000000-0000-4000-8000-000000000010'
        AND opportunity_id='75000000-0000-4000-8000-000000000003'
        AND repreneur_id='75000000-0000-4000-8000-000000000041') THEN
    RAISE EXCEPTION 'same-statement pair publication lost its exact cycle';
  END IF;
END $$;
UPDATE public.opportunity_matches
  SET repreneur_id='75000000-0000-4000-8000-000000000004'
  WHERE id='75000000-0000-4000-8000-000000000010';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.opportunity_recommendation_cycles
    WHERE match_id='75000000-0000-4000-8000-000000000010')<>1
    OR EXISTS(SELECT 1 FROM public.opportunity_recommendation_cycle_deliveries d
      JOIN public.opportunity_recommendation_cycles c ON c.id=d.cycle_id
      WHERE c.match_id='75000000-0000-4000-8000-000000000010'
        AND d.status<>'suppressed') THEN
    RAISE EXCEPTION 'pair-only reassignment revived/minted an old cycle';
  END IF;
END $$;

-- Caller-prefilled clocks and raw clock edits cannot mint events.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.opportunity_matches
      (id,opportunity_id,repreneur_id,status,created_by,recommendation_published_at,recommendation_expires_at)
    VALUES('75000000-0000-4000-8000-000000000013',
      '75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000005',
      'proposed','w175-staff',clock_timestamp(),clock_timestamp()+INTERVAL '72 hours');
    RAISE EXCEPTION 'prefilled publication was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%recommendation_clock_canonical_source_required%'
      THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.opportunity_matches
      SET recommendation_expires_at=recommendation_expires_at+INTERVAL '1 hour'
      WHERE id='75000000-0000-4000-8000-000000000011';
    RAISE EXCEPTION 'raw clock edit was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%recommendation_clock_canonical_source_required%'
      THEN RAISE; END IF;
  END;
END $$;
