-- Disposable proof for the operational-alert incident ledger. The fixture owns
-- all direct timestamp changes below; production callers use only the RPCs.
DO $$
DECLARE v_claim jsonb; v_repeat jsonb; v_retry jsonb; v_quiet jsonb; v_reopened jsonb;
  v_id uuid; v_token uuid; v_payload jsonb; v_key text;
BEGIN
  v_claim:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-a','WAVE <alerts@example.test>','ops@example.test');
  IF v_claim IS NULL OR v_claim->>'kind'<>'opening' OR v_claim->'payload'->>'operation'<>'email.resend_webhook'
    OR v_claim->'payload' ? 'customer' THEN RAISE EXCEPTION 'opening claim did not contain the bounded technical snapshot'; END IF;
  v_id:=(v_claim->>'id')::uuid; v_token:=(v_claim->>'lease_token')::uuid; v_key:=v_claim->>'idempotency_key'; v_payload:=v_claim->'payload';
  v_repeat:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-b','WAVE <alerts@example.test>','ops@example.test');
  IF v_repeat IS NOT NULL THEN RAISE EXCEPTION 'duplicate failure created another opening alert'; END IF;
  UPDATE public.critical_alert_notifications SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=v_id;
  SELECT value INTO v_retry FROM public.critical_alert_claim_due('WAVE <alerts@example.test>','ops@example.test',8) value WHERE value->>'id'=v_id::text;
  IF v_retry IS NULL OR v_retry->>'idempotency_key' IS DISTINCT FROM v_key OR v_retry->'payload' IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'expired opening lease did not reclaim its frozen provider envelope'; END IF;
  IF NOT public.critical_alert_complete(v_id,(v_retry->>'lease_token')::uuid,'provider-opening') THEN RAISE EXCEPTION 'opening completion failed'; END IF;
  UPDATE public.critical_alert_notifications SET last_attempt_at=clock_timestamp()-interval '24 hours 1 second' WHERE id=v_id;
  v_claim:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-c','WAVE <alerts@example.test>','ops@example.test');
  IF v_claim IS NULL OR v_claim->>'kind'<>'reminder' THEN RAISE EXCEPTION '24h reminder was not claimed'; END IF;
  v_id:=(v_claim->>'id')::uuid; v_token:=(v_claim->>'lease_token')::uuid; v_key:=v_claim->>'idempotency_key'; v_payload:=v_claim->'payload';
  IF NOT public.critical_alert_release(v_id,v_token) THEN RAISE EXCEPTION 'provider failure did not release the lease'; END IF;
  UPDATE public.critical_alert_notifications SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=v_id;
  -- The next real failure reclaims the due retry before considering a new reminder.
  v_retry:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-c','WAVE <alerts@example.test>','ops@example.test');
  IF v_retry IS NULL OR v_retry->>'idempotency_key' IS DISTINCT FROM v_key OR v_retry->'payload' IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'retry changed the frozen snapshot or provider key'; END IF;
  IF NOT public.critical_alert_complete(v_id,(v_retry->>'lease_token')::uuid,'provider-reminder') THEN RAISE EXCEPTION 'reminder completion failed'; END IF;

  -- A live incident may receive another reminder only after another 24h.
  UPDATE public.critical_alert_notifications SET last_attempt_at=clock_timestamp()-interval '24 hours 1 second' WHERE id=v_id;
  v_claim:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-c','WAVE <alerts@example.test>','ops@example.test');
  IF v_claim IS NULL OR v_claim->>'kind'<>'reminder' OR (SELECT count(*) FROM public.critical_alert_notifications n
      JOIN public.critical_alert_incidents i ON i.id=n.incident_id
      WHERE i.operation='email.resend_webhook' AND i.error_category='persistence_failed' AND n.kind='reminder') <> 2
  THEN RAISE EXCEPTION 'reminder frequency was not bounded to one per 24 hours'; END IF;
  IF NOT public.critical_alert_complete((v_claim->>'id')::uuid,(v_claim->>'lease_token')::uuid,'provider-reminder-two') THEN
    RAISE EXCEPTION 'second reminder completion failed'; END IF;

  -- A retry older than the bounded reconciliation window becomes uncertain.
  UPDATE public.critical_alert_notifications SET state='pending',first_attempt_at=clock_timestamp()-interval '23 hours 1 second',
    next_attempt_at=clock_timestamp()-interval '1 second',lease_token=NULL,lease_expires_at=NULL,
    sent_at=NULL,provider_id=NULL WHERE id=v_id;
  PERFORM public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-c','WAVE <alerts@example.test>','ops@example.test');
  IF (SELECT state FROM public.critical_alert_notifications WHERE id=v_id) <> 'uncertain' THEN RAISE EXCEPTION 'expired retry was replayed instead of marked uncertain'; END IF;

  -- A quiet notice is factual as of its claim; a later failure becomes a new
  -- episode. Pending quiet notices can be cancelled before they are attempted.
  UPDATE public.critical_alert_incidents SET last_failure_at=clock_timestamp()-interval '24 hours 1 second'
   WHERE environment='production' AND operation='email.resend_webhook' AND error_category='persistence_failed' AND state='active';
  SELECT value INTO v_quiet FROM public.critical_alert_claim_due('WAVE <alerts@example.test>','ops@example.test',8) value WHERE value->>'kind'='quiet';
  IF v_quiet IS NULL THEN RAISE EXCEPTION 'quiet notice was not claimed after 24h'; END IF;
  IF NOT public.critical_alert_complete((v_quiet->>'id')::uuid,(v_quiet->>'lease_token')::uuid,'provider-quiet') THEN RAISE EXCEPTION 'quiet completion failed'; END IF;
  v_reopened:=public.critical_alert_observe('email.resend_webhook','persistence_failed','production','release-d','WAVE <alerts@example.test>','ops@example.test');
  IF v_reopened IS NULL OR v_reopened->>'kind'<>'opening' THEN RAISE EXCEPTION 'failure after quiet did not open a new episode'; END IF;
END $$;

DO $$
DECLARE v_episode uuid; v_claim jsonb; v_pending uuid; v_old uuid;
BEGIN
  INSERT INTO public.critical_alert_incidents(environment,operation,error_category,episode_number,release,state,quieted_at)
  VALUES('production','cron.discovery_digest','internal_error',1,'release-a','quiet',clock_timestamp()) RETURNING id INTO v_episode;
  INSERT INTO public.critical_alert_notifications(incident_id,kind,idempotency_key,payload)
  VALUES(v_episode,'quiet','wave-critical:fixture:quiet:pending',jsonb_build_object('notice_at',clock_timestamp())) RETURNING id INTO v_pending;
  v_claim:=public.critical_alert_observe('cron.discovery_digest','internal_error','production','release-b','WAVE <alerts@example.test>','ops@example.test');
  IF v_claim IS NULL OR v_claim->>'kind'<>'opening' THEN RAISE EXCEPTION 'new failure after quiet did not create a new episode'; END IF;
  IF (SELECT state FROM public.critical_alert_notifications WHERE id=v_pending) <> 'cancelled' THEN RAISE EXCEPTION 'stale unattempted quiet remained sendable'; END IF;

  INSERT INTO public.critical_alert_incidents(environment,operation,error_category,episode_number,release,state,quieted_at)
  VALUES('production','cron.abandoned_forms','storage_failed',1,'release-a','quiet',clock_timestamp()-interval '91 days') RETURNING id INTO v_old;
  INSERT INTO public.critical_alert_notifications(incident_id,kind,idempotency_key,payload)
  VALUES(v_old,'quiet','wave-critical:fixture:retention',jsonb_build_object('notice_at',clock_timestamp()-interval '91 days'));
  PERFORM public.critical_alert_housekeep();
  IF NOT EXISTS(SELECT 1 FROM public.critical_alert_incidents WHERE id=v_old) THEN
    RAISE EXCEPTION 'unresolved quiet metadata was deleted'; END IF;
  UPDATE public.critical_alert_notifications SET state='sent',sent_at=clock_timestamp(),provider_id='provider-retention'
    WHERE incident_id=v_old;
  PERFORM public.critical_alert_housekeep();
  IF EXISTS(SELECT 1 FROM public.critical_alert_incidents WHERE id=v_old)
    OR EXISTS(SELECT 1 FROM public.critical_alert_notifications WHERE incident_id=v_old)
  THEN RAISE EXCEPTION 'terminal quiet metadata was not removed after retention'; END IF;
END $$;

DO $$
BEGIN
  PERFORM public.critical_alert_observe('bad operation','internal_error','production','r','a','b');
  RAISE EXCEPTION 'invalid operation was accepted';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM <> 'critical_alert_invalid' THEN RAISE; END IF;
END $$;
