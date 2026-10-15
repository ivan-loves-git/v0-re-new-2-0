-- Durable, service-only operational-alert episodes.  This deliberately holds
-- technical identity and frozen notification snapshots only: no request,
-- customer, transaction, IP, or error-body data is retained here.
BEGIN;

CREATE TABLE public.critical_alert_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment = 'production'),
  operation text NOT NULL CHECK (operation ~ '^[a-z][a-z0-9_.-]{0,119}$'),
  error_category text NOT NULL CHECK (error_category IN (
    'configuration_error','internal_error','persistence_failed',
    'provider_rejected','provider_unavailable','storage_failed'
  )),
  episode_number integer NOT NULL CHECK (episode_number > 0),
  release text NOT NULL DEFAULT '',
  first_failure_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_failure_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  failure_count integer NOT NULL DEFAULT 1 CHECK (failure_count > 0),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','quiet')),
  quieted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state = 'active' AND quieted_at IS NULL) OR (state = 'quiet' AND quieted_at IS NOT NULL))
);
CREATE UNIQUE INDEX critical_alert_incidents_active_identity
  ON public.critical_alert_incidents(environment,operation,error_category)
  WHERE state = 'active';
CREATE INDEX critical_alert_incidents_retention
  ON public.critical_alert_incidents(state,updated_at);

CREATE TABLE public.critical_alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.critical_alert_incidents(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('opening','reminder','quiet')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','sent','uncertain','cancelled')),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 16 AND 200),
  payload jsonb NOT NULL,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  CHECK ((state = 'leased') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK ((state = 'sent') = (sent_at IS NOT NULL)),
  CHECK ((state <> 'sent') OR provider_id IS NOT NULL)
);
-- Opening and quiet are each one-off per episode. Reminders are intentionally
-- repeatable, but only the observer may create one and it gates them by the
-- last provider attempt (at most one per rolling 24-hour interval).
CREATE UNIQUE INDEX critical_alert_notifications_one_off_per_kind
  ON public.critical_alert_notifications(incident_id,kind)
  WHERE kind IN ('opening','quiet');
CREATE INDEX critical_alert_notifications_due
  ON public.critical_alert_notifications(state,next_attempt_at);

ALTER TABLE public.critical_alert_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_alert_incidents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.critical_alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_alert_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.critical_alert_incidents,public.critical_alert_notifications FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.critical_alert_notification_payload(
  p_incident public.critical_alert_incidents,
  p_kind text,p_from text,p_recipient text,p_notice_at timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object(
    'format_version',1,
    'environment',p_incident.environment,
    'operation',p_incident.operation,
    'error_category',p_incident.error_category,
    'release',p_incident.release,
    'first_failure_at',p_incident.first_failure_at,
    'last_failure_at',p_incident.last_failure_at,
    'failure_count',p_incident.failure_count,
    'notice_at',p_notice_at,
    'from_email',p_from,
    'recipient',p_recipient,
    'kind',p_kind
  );
$$;

CREATE FUNCTION public.critical_alert_claim_notification(p_notification_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_notification public.critical_alert_notifications%ROWTYPE;
  v_token uuid:=gen_random_uuid(); v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO v_notification FROM public.critical_alert_notifications
  WHERE id=p_notification_id FOR UPDATE;
  IF v_notification.id IS NULL OR v_notification.state <> 'pending'
    OR v_notification.next_attempt_at > v_now
    OR (v_notification.first_attempt_at IS NOT NULL AND v_notification.first_attempt_at < v_now-interval '23 hours')
  THEN
    RETURN NULL;
  END IF;
  UPDATE public.critical_alert_notifications SET
    state='leased',lease_token=v_token,lease_expires_at=v_now+interval '120 seconds',
    first_attempt_at=coalesce(first_attempt_at,v_now),last_attempt_at=v_now,
    attempt_count=attempt_count+1,updated_at=v_now
  WHERE id=v_notification.id;
  RETURN jsonb_build_object('id',v_notification.id,'lease_token',v_token,
    'idempotency_key',v_notification.idempotency_key,'kind',v_notification.kind,
    'payload',v_notification.payload);
END $$;

CREATE FUNCTION public.critical_alert_observe(
  p_operation text,p_category text,p_environment text,p_release text,p_from text,p_recipient text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_incident public.critical_alert_incidents%ROWTYPE;
  v_now timestamptz:=clock_timestamp(); v_notification_id uuid; v_episode integer;
  v_key text;
BEGIN
  IF p_environment <> 'production' OR p_operation !~ '^[a-z][a-z0-9_.-]{0,119}$'
    OR p_category NOT IN ('configuration_error','internal_error','persistence_failed','provider_rejected','provider_unavailable','storage_failed')
    OR nullif(btrim(p_from),'') IS NULL OR length(p_from)>320
    OR nullif(btrim(p_recipient),'') IS NULL OR length(p_recipient)>320
    OR length(coalesce(p_release,''))>80
  THEN RAISE EXCEPTION 'critical_alert_invalid'; END IF;

  -- The partial active-episode index protects persistence. This transaction
  -- lock also gives concurrent observers a deterministic episode number when
  -- a quiet episode is reopened.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(concat_ws('|',p_environment,p_operation,p_category),0));

  SELECT * INTO v_incident FROM public.critical_alert_incidents
   WHERE environment=p_environment AND operation=p_operation AND error_category=p_category AND state='active'
   FOR UPDATE;
  IF v_incident.id IS NULL THEN
    UPDATE public.critical_alert_notifications n SET state='cancelled',updated_at=v_now
    FROM public.critical_alert_incidents q
    WHERE n.incident_id=q.id AND q.environment=p_environment AND q.operation=p_operation
      AND q.error_category=p_category AND q.state='quiet' AND n.kind='quiet'
      AND n.state='pending' AND n.first_attempt_at IS NULL;
    SELECT coalesce(max(episode_number),0)+1 INTO v_episode FROM public.critical_alert_incidents
     WHERE environment=p_environment AND operation=p_operation AND error_category=p_category;
    INSERT INTO public.critical_alert_incidents(environment,operation,error_category,episode_number,release)
    VALUES(p_environment,p_operation,p_category,v_episode,coalesce(p_release,'')) RETURNING * INTO v_incident;
    -- The provider key is deliberately opaque. Its stable UUID belongs to the
    -- notification row and is reused for every bounded retry.
    v_key:='wave-critical:'||gen_random_uuid()::text;
    INSERT INTO public.critical_alert_notifications(incident_id,kind,idempotency_key,payload)
    VALUES(v_incident.id,'opening',v_key,public.critical_alert_notification_payload(v_incident,'opening',p_from,p_recipient,v_now))
    RETURNING id INTO v_notification_id;
    RETURN public.critical_alert_claim_notification(v_notification_id);
  END IF;

  UPDATE public.critical_alert_incidents SET last_failure_at=v_now,failure_count=failure_count+1,
    release=coalesce(nullif(btrim(p_release),''),release),updated_at=v_now WHERE id=v_incident.id RETURNING * INTO v_incident;
  -- An unsent quiet message is stale as soon as a new failure arrives.  A
  -- leased quiet message is already an in-flight factual "as of" notice.
  UPDATE public.critical_alert_notifications SET state='cancelled',updated_at=v_now
   WHERE incident_id=v_incident.id AND kind='quiet' AND state='pending' AND first_attempt_at IS NULL;

  -- Reclaim an expired lease only while the original attempt remains inside
  -- the bounded reconciliation window. The notification row owns the frozen
  -- payload and opaque provider key, so this never creates a second alert.
  UPDATE public.critical_alert_notifications SET state='uncertain',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
   WHERE incident_id=v_incident.id AND state IN ('pending','leased')
     AND first_attempt_at IS NOT NULL AND first_attempt_at < v_now-interval '23 hours'
     AND (state='pending' OR lease_expires_at<=v_now);
  UPDATE public.critical_alert_notifications SET state='pending',lease_token=NULL,lease_expires_at=NULL,
    next_attempt_at=v_now,updated_at=v_now
   WHERE incident_id=v_incident.id AND state='leased' AND lease_expires_at<=v_now
     AND first_attempt_at>=v_now-interval '23 hours';
  SELECT id INTO v_notification_id FROM public.critical_alert_notifications
   WHERE incident_id=v_incident.id AND state='pending' AND next_attempt_at<=v_now
     AND (first_attempt_at IS NULL OR first_attempt_at>=v_now-interval '23 hours')
   ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_notification_id IS NOT NULL THEN RETURN public.critical_alert_claim_notification(v_notification_id); END IF;

  IF NOT EXISTS(SELECT 1 FROM public.critical_alert_notifications
      WHERE incident_id=v_incident.id AND kind='reminder' AND last_attempt_at > v_now-interval '24 hours')
    AND EXISTS(SELECT 1 FROM public.critical_alert_notifications
      WHERE incident_id=v_incident.id AND kind IN ('opening','reminder') AND last_attempt_at <= v_now-interval '24 hours')
  THEN
    v_key:='wave-critical:'||gen_random_uuid()::text;
    INSERT INTO public.critical_alert_notifications(incident_id,kind,idempotency_key,payload)
    VALUES(v_incident.id,'reminder',v_key,public.critical_alert_notification_payload(v_incident,'reminder',p_from,p_recipient,v_now))
    ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_notification_id;
    IF v_notification_id IS NOT NULL THEN RETURN public.critical_alert_claim_notification(v_notification_id); END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.critical_alert_claim_due(p_from text,p_recipient text,p_limit int DEFAULT 8)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp(); v_incident public.critical_alert_incidents%ROWTYPE;
  v_id uuid; v_claim jsonb; v_limit int:=least(greatest(coalesce(p_limit,8),1),32); v_count int:=0; v_key text;
BEGIN
  IF nullif(btrim(p_from),'') IS NULL OR length(p_from)>320 OR nullif(btrim(p_recipient),'') IS NULL OR length(p_recipient)>320
  THEN RAISE EXCEPTION 'critical_alert_invalid'; END IF;
  PERFORM public.critical_alert_housekeep();
  -- Always lock the episode before its notifications. Observe uses the same
  -- order, so the cron cannot invert locks with an incoming failure.
  FOR v_incident IN SELECT * FROM public.critical_alert_incidents
    WHERE (state='active' AND last_failure_at <= v_now-interval '24 hours')
      OR EXISTS(SELECT 1 FROM public.critical_alert_notifications n
        WHERE n.incident_id=critical_alert_incidents.id
          AND ((n.state='leased' AND n.lease_expires_at<=v_now)
            OR (n.state='pending' AND n.next_attempt_at<=v_now)))
    ORDER BY last_failure_at FOR UPDATE SKIP LOCKED
  LOOP
    EXIT WHEN v_count>=v_limit;
    UPDATE public.critical_alert_notifications SET state='uncertain',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
     WHERE incident_id=v_incident.id AND state IN ('pending','leased')
       AND first_attempt_at IS NOT NULL AND first_attempt_at < v_now-interval '23 hours'
       AND (state='pending' OR lease_expires_at<=v_now);
    UPDATE public.critical_alert_notifications SET state='pending',next_attempt_at=v_now,
      lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
     WHERE incident_id=v_incident.id AND state='leased' AND lease_expires_at<=v_now
       AND first_attempt_at>=v_now-interval '23 hours';

    IF v_incident.state='active' AND v_incident.last_failure_at<=v_now-interval '24 hours' THEN
      UPDATE public.critical_alert_incidents SET state='quiet',quieted_at=v_now,updated_at=v_now WHERE id=v_incident.id RETURNING * INTO v_incident;
      v_key:='wave-critical:'||gen_random_uuid()::text;
      INSERT INTO public.critical_alert_notifications(incident_id,kind,idempotency_key,payload,next_attempt_at)
      VALUES(v_incident.id,'quiet',v_key,public.critical_alert_notification_payload(v_incident,'quiet',p_from,p_recipient,v_now),v_now)
      ON CONFLICT(idempotency_key) DO NOTHING;
    END IF;

    v_id:=NULL;
    SELECT id INTO v_id FROM public.critical_alert_notifications
    WHERE incident_id=v_incident.id AND state='pending' AND next_attempt_at<=v_now
      AND (first_attempt_at IS NULL OR first_attempt_at>=v_now-interval '23 hours')
    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_id IS NOT NULL THEN
    v_claim:=public.critical_alert_claim_notification(v_id);
    IF v_claim IS NOT NULL THEN v_count:=v_count+1; RETURN NEXT v_claim; END IF;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.critical_alert_complete(p_notification_id uuid,p_lease_token uuid,p_provider_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp();
BEGIN
  IF nullif(btrim(p_provider_id),'') IS NULL OR length(p_provider_id)>320 THEN RAISE EXCEPTION 'critical_alert_invalid'; END IF;
  UPDATE public.critical_alert_notifications SET state='sent',provider_id=btrim(p_provider_id),sent_at=v_now,
    lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
  WHERE id=p_notification_id AND state='leased' AND lease_token=p_lease_token AND lease_expires_at>v_now;
  RETURN FOUND;
END $$;

CREATE FUNCTION public.critical_alert_release(p_notification_id uuid,p_lease_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_now timestamptz:=clock_timestamp();
BEGIN
  UPDATE public.critical_alert_notifications SET state=CASE WHEN first_attempt_at < v_now-interval '23 hours' THEN 'uncertain' ELSE 'pending' END,
    next_attempt_at=CASE WHEN first_attempt_at < v_now-interval '23 hours' THEN next_attempt_at ELSE v_now+interval '5 minutes' END,
    lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
  WHERE id=p_notification_id AND state='leased' AND lease_token=p_lease_token AND lease_expires_at>v_now;
  RETURN FOUND;
END $$;

-- Metadata only, after the stated retention period.  The application cron may
-- call this later; this migration does not delete historic records.
CREATE FUNCTION public.critical_alert_housekeep()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_deleted integer; v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO v_ids FROM (
    SELECT i.id FROM public.critical_alert_incidents i
    WHERE i.state='quiet' AND i.quieted_at<clock_timestamp()-interval '90 days'
      AND NOT EXISTS(SELECT 1 FROM public.critical_alert_notifications n
        WHERE n.incident_id=i.id AND n.state NOT IN ('sent','cancelled'))
    ORDER BY i.quieted_at LIMIT 100
  ) eligible;
  IF cardinality(v_ids)=0 THEN RETURN 0; END IF;
  DELETE FROM public.critical_alert_notifications WHERE incident_id=ANY(v_ids);
  DELETE FROM public.critical_alert_incidents WHERE id=ANY(v_ids);
  GET DIAGNOSTICS v_deleted=ROW_COUNT; RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.critical_alert_notification_payload(public.critical_alert_incidents,text,text,text,timestamptz),
  public.critical_alert_claim_notification(uuid),public.critical_alert_observe(text,text,text,text,text,text),
  public.critical_alert_claim_due(text,text,integer),public.critical_alert_complete(uuid,uuid,text),
  public.critical_alert_release(uuid,uuid),public.critical_alert_housekeep() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.critical_alert_observe(text,text,text,text,text,text),
  public.critical_alert_claim_due(text,text,integer),public.critical_alert_complete(uuid,uuid,text),
  public.critical_alert_release(uuid,uuid),public.critical_alert_housekeep() TO service_role;

COMMIT;
