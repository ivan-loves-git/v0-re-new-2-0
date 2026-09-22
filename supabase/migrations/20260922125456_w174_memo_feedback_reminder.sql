-- Ticket #174 / Decision #161. A reminder is due after five following
-- Monday-Friday civil dates in Paris, at the grant's original local time.
-- European DST changes occur on Sundays, so the target weekday is unambiguous.
CREATE FUNCTION public.w174_paris_fifth_weekday_due(p_granted_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE STRICT SET search_path=public,pg_temp AS $$
DECLARE
  v_local TIMESTAMP:=p_granted_at AT TIME ZONE 'Europe/Paris';
  v_day DATE:=v_local::date;
  v_count INTEGER:=0;
BEGIN
  WHILE v_count<5 LOOP
    v_day:=v_day+1;
    IF EXTRACT(ISODOW FROM v_day)<=5 THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN (v_day::TIMESTAMP+(v_local-date_trunc('day',v_local))) AT TIME ZONE 'Europe/Paris';
END $$;
REVOKE ALL ON FUNCTION public.w174_paris_fifth_weekday_due(TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.w174_paris_fifth_weekday_due(TIMESTAMPTZ) TO service_role;

-- One immutable grant is one logical reminder. The mutable grant row is used
-- only for current entitlement, never as the reminder's generation identity.
CREATE TABLE public.opportunity_memo_feedback_reminders (
  grant_evidence_id UUID PRIMARY KEY REFERENCES public.opportunity_pursuit_evidence(id) ON DELETE RESTRICT,
  match_id UUID NOT NULL REFERENCES public.opportunity_matches(id) ON DELETE RESTRICT,
  due_at TIMESTAMPTZ NOT NULL,
  template_key TEXT NOT NULL DEFAULT 'memo_feedback_reminder',
  template_updated_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK(status IN ('pending','failed','sent','suppressed','review_required')),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  payload_sha256 TEXT CHECK(payload_sha256 IS NULL OR payload_sha256 ~ '^[a-f0-9]{64}$'),
  provider_attempted_at TIMESTAMPTZ,
  provider_outcome TEXT CHECK(provider_outcome IS NULL OR provider_outcome IN ('attempting','uncertain','rejected','accepted','blocked','deferred')),
  provider_inflight BOOLEAN NOT NULL DEFAULT false,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX opportunity_memo_feedback_reminders_due
  ON public.opportunity_memo_feedback_reminders(due_at,updated_at,grant_evidence_id)
  WHERE status IN ('pending','failed');
ALTER TABLE public.opportunity_memo_feedback_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_memo_feedback_reminders FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.opportunity_memo_feedback_reminders FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(grant_evidence_id,match_id,due_at,status,created_at,updated_at)
  ON public.opportunity_memo_feedback_reminders TO service_role;
-- The isolated #173 recovery route rotates failed work by last evaluation;
-- this additive read grant does not broaden portal or staff-table access.
GRANT SELECT(updated_at) ON public.opportunity_interest_notification_deliveries TO service_role;

INSERT INTO public.email_templates(template_key,subject,description,is_active,requires_consent,body_markdown,body_editable)
VALUES('memo_feedback_reminder','Un retour sur votre mémorandum — {opportunityTitle}',
  'One staff-configured reminder five Paris weekdays after the exact confidential memo grant.',
  false,false,
  E'Bonjour {firstName},\n\nAprès votre accès au mémorandum de {opportunityTitle}, nous serions heureux de recueillir votre retour. Si vous nous l’avez déjà transmis, aucune action supplémentaire n’est nécessaire.\n\nL’équipe Re-New',
  true)
ON CONFLICT(template_key) DO NOTHING;

-- Prospective only. A key disabled or missing when the grant commits creates
-- a terminal suppression, not a future backlog when staff later enables it.
CREATE FUNCTION public.w174_record_memo_feedback_reminder()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_template public.email_templates%ROWTYPE; v_real BOOLEAN;
BEGIN
  IF NEW.event_type<>'confidential_access_granted' THEN RETURN NEW; END IF;
  SELECT * INTO v_template FROM public.email_templates WHERE template_key='memo_feedback_reminder';
  SELECT o.is_demo=false AND r.is_demo=false INTO v_real
    FROM public.opportunity_matches m JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id WHERE m.id=NEW.match_id;
  INSERT INTO public.opportunity_memo_feedback_reminders
    (grant_evidence_id,match_id,due_at,template_updated_at,status)
  VALUES(NEW.id,NEW.match_id,public.w174_paris_fifth_weekday_due(NEW.recorded_at),v_template.updated_at,
    CASE WHEN v_template.is_active IS TRUE AND v_real IS TRUE THEN 'pending' ELSE 'suppressed' END);
  RETURN NEW;
END $$;
CREATE TRIGGER w174_record_memo_feedback_reminder AFTER INSERT ON public.opportunity_pursuit_evidence
  FOR EACH ROW WHEN (NEW.event_type='confidential_access_granted')
  EXECUTE FUNCTION public.w174_record_memo_feedback_reminder();

-- This checks the current portal entitlement and the *latest immutable grant*
-- separately. A regrant can reuse the same mutable grant row, document, and
-- NDA expiry; none of those is proof that an older reminder is still current.
CREATE FUNCTION public.w174_grant_is_current(p_grant_evidence_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.opportunity_pursuit_evidence e
    JOIN public.opportunity_matches m ON m.id=e.match_id
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id
    JOIN public.opportunity_pursuit_confidential_grants g ON g.match_id=m.id
    WHERE e.id=p_grant_evidence_id AND e.event_type='confidential_access_granted'
      AND e.id=(SELECT newer.id FROM public.opportunity_pursuit_evidence newer
        WHERE newer.match_id=m.id AND newer.event_type='confidential_access_granted'
        ORDER BY newer.recorded_at DESC,newer.id DESC LIMIT 1)
      AND m.status='active_pursuit' AND o.status='active'
      AND public.w164_match_has_same_namespace(m.id)
      AND EXISTS(SELECT 1 FROM public.app_user_roles role_row
        WHERE role_row.role='repreneur' AND role_row.repreneur_id=r.id AND role_row.user_id IS NOT NULL)
      AND g.revoked_at IS NULL AND g.nda_expires_at>now()
      AND g.information_memo_document_id=e.document_id
      AND g.cycle_started_evidence_id::TEXT=e.metadata->>'cycle_started_evidence_id'
      AND g.gate_2_evidence_id::TEXT=e.metadata->>'gate_2_evidence_id'
      AND g.dispatch_evidence_id::TEXT=e.metadata->>'dispatch_evidence_id'
      AND g.nda_expires_at=(e.metadata->>'nda_expires_at')::timestamptz
      AND public.journey_repreneur_can_access_confidential(m.id,r.id,e.document_id)
  )
$$;

CREATE UNIQUE INDEX opportunity_memo_feedback_once_per_grant
  ON public.opportunity_pursuit_evidence((metadata->>'grant_evidence_id'))
  WHERE event_type='memo_feedback_received';

-- Only staff can attest substantive feedback actually received by email or
-- phone. The displayed grant UUID is mandatory: a stale page for grant A may
-- never silently record feedback against later grant B.
CREATE FUNCTION public.w174_record_memo_feedback(
  p_match_id UUID,p_grant_evidence_id UUID,p_actor TEXT,p_channel TEXT,p_received_at TIMESTAMPTZ
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match public.opportunity_matches%ROWTYPE; v_grant public.opportunity_pursuit_evidence%ROWTYPE;
  v_existing public.opportunity_pursuit_evidence%ROWTYPE; v_event UUID; v_delivery public.opportunity_memo_feedback_reminders%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF (SELECT count(*) FROM public.app_user_roles
      WHERE role='staff' AND (user_id=p_actor OR email=p_actor))<>1 THEN
    RAISE EXCEPTION 'Exact staff authority is required to record memo feedback.';
  END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('email','phone') OR p_received_at IS NULL
    OR p_received_at>v_now OR p_received_at<'2000-01-01'::timestamptz THEN
    RAISE EXCEPTION 'Record an actual email or phone receipt time.';
  END IF;
  SELECT * INTO v_match FROM public.opportunity_matches WHERE id=p_match_id FOR UPDATE;
  SELECT * INTO v_grant FROM public.opportunity_pursuit_evidence
    WHERE id=p_grant_evidence_id AND match_id=p_match_id AND event_type='confidential_access_granted';
  IF v_match.id IS NULL OR v_grant.id IS NULL OR p_received_at<v_grant.recorded_at
    OR NOT public.w164_match_has_same_namespace(v_match.id) THEN
    RAISE EXCEPTION 'The displayed memo grant is stale or feedback predates it. Refresh before recording.';
  END IF;
  SELECT * INTO v_existing FROM public.opportunity_pursuit_evidence
    WHERE event_type='memo_feedback_received' AND metadata->>'grant_evidence_id'=p_grant_evidence_id::TEXT;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.actor IS DISTINCT FROM p_actor
      OR v_existing.metadata->>'channel' IS DISTINCT FROM p_channel
      OR (v_existing.metadata->>'received_at')::timestamptz IS DISTINCT FROM p_received_at THEN
      RAISE EXCEPTION 'Feedback already recorded for this exact grant; do not replace its evidence.';
    END IF;
    RETURN v_existing.id;
  END IF;
  IF NOT public.w174_grant_is_current(p_grant_evidence_id) THEN
    RAISE EXCEPTION 'The displayed memo grant is stale. Refresh before recording.';
  END IF;
  v_event:=public.journey_append_evidence(p_match_id,'memo_feedback_received',p_actor,
    'w174-feedback:'||p_grant_evidence_id::TEXT,NULL,NULL,NULL,
    jsonb_build_object('grant_evidence_id',p_grant_evidence_id,'channel',p_channel,'received_at',p_received_at));
  -- journey_append_evidence returns an existing ID on idempotency conflict;
  -- verify that it truly represents this exact receipt, not another event.
  SELECT * INTO v_existing FROM public.opportunity_pursuit_evidence WHERE id=v_event;
  IF v_existing.event_type<>'memo_feedback_received'
    OR v_existing.actor IS DISTINCT FROM p_actor
    OR v_existing.metadata->>'grant_evidence_id' IS DISTINCT FROM p_grant_evidence_id::TEXT
    OR v_existing.metadata->>'channel' IS DISTINCT FROM p_channel
    OR (v_existing.metadata->>'received_at')::timestamptz IS DISTINCT FROM p_received_at THEN
    RAISE EXCEPTION 'Conflicting feedback evidence idempotency key.';
  END IF;
  SELECT * INTO v_delivery FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id FOR UPDATE;
  IF v_delivery.status IN ('pending','failed') THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status=CASE WHEN v_delivery.provider_outcome IN ('attempting','uncertain')
        THEN 'review_required' ELSE 'suppressed' END,
        lease_token=CASE WHEN v_delivery.provider_inflight
          THEN lease_token ELSE NULL END,
        lease_expires_at=CASE WHEN v_delivery.provider_inflight
          THEN lease_expires_at ELSE NULL END,
        updated_at=v_now WHERE grant_evidence_id=p_grant_evidence_id;
  END IF;
  RETURN v_event;
END $$;

-- Only neutral, portal-safe fields are allowed into the outbound payload.
-- This is re-evaluated at claim and again immediately before provider I/O.
CREATE FUNCTION public.w174_memo_feedback_delivery_payload(p_grant_evidence_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payload JSONB;
BEGIN
  SELECT jsonb_build_object('grantEvidenceId',e.id,'matchId',m.id,
    'repreneurId',r.id,'recipientEmail',public.w175_assignment_recipient_email(r.email),
    'firstName',COALESCE(NULLIF(BTRIM(r.first_name),''),'Bonjour'),
    'opportunityTitle',COALESCE(NULLIF(BTRIM(o.public_title),''),'cette opportunité'),
    'templateKey',d.template_key,'subject',t.subject,'body',t.body_markdown)
  INTO v_payload FROM public.opportunity_memo_feedback_reminders d
    JOIN public.opportunity_pursuit_evidence e ON e.id=d.grant_evidence_id
    JOIN public.opportunity_matches m ON m.id=e.match_id
    JOIN public.opportunities o ON o.id=m.opportunity_id
    JOIN public.repreneurs r ON r.id=m.repreneur_id
    JOIN public.email_templates t ON t.template_key=d.template_key
  WHERE d.grant_evidence_id=p_grant_evidence_id
    AND d.status IN ('pending','failed')
    AND (d.payload_sha256 IS NULL OR d.template_updated_at=t.updated_at)
    AND t.is_active IS TRUE
    AND (t.requires_consent IS FALSE OR r.marketing_consent IS TRUE)
    AND o.is_demo=false AND r.is_demo=false
    AND public.w175_assignment_recipient_email(r.email) IS NOT NULL
    AND NOT public.ma_contact_email_address_is_suppressed(r.email)
    AND public.w174_grant_is_current(e.id)
    AND NOT EXISTS(SELECT 1 FROM public.opportunity_pursuit_evidence feedback
      WHERE feedback.event_type='memo_feedback_received'
        AND feedback.metadata->>'grant_evidence_id'=e.id::TEXT);
  RETURN v_payload;
END $$;

-- Match lock comes first in claim, begin, and staff receipt. A receipt that
-- wins the lock suppresses an unstarted send; a claim that wins still needs
-- the same fresh eligibility check at the provider boundary.
CREATE FUNCTION public.w174_claim_memo_feedback_reminder(p_grant_evidence_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID; v_delivery public.opportunity_memo_feedback_reminders%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp(); v_token UUID:=gen_random_uuid();
BEGIN
  SELECT match_id INTO v_match FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id;
  IF v_match IS NULL THEN RETURN jsonb_build_object('status','missing'); END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=v_match FOR UPDATE;
  SELECT * INTO v_delivery FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id FOR UPDATE;
  IF v_delivery.status IN ('sent','suppressed','review_required') THEN
    RETURN jsonb_build_object('status',v_delivery.status);
  END IF;
  IF v_delivery.due_at>v_now THEN RETURN jsonb_build_object('status','not_due'); END IF;
  IF v_delivery.lease_expires_at>v_now THEN RETURN jsonb_build_object('status','busy'); END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain')
    AND (v_delivery.provider_attempted_at IS NULL
      OR v_delivery.provider_attempted_at<=v_now-interval '23 hours') THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,
        provider_inflight=false,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN jsonb_build_object('status','review_required');
  END IF;
  IF v_delivery.provider_outcome='attempting' THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET provider_outcome='uncertain',provider_inflight=false,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    v_delivery.provider_outcome:='uncertain';
  END IF;
  IF public.w174_memo_feedback_delivery_payload(p_grant_evidence_id) IS NULL THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status=CASE WHEN v_delivery.payload_sha256 IS NULL THEN 'suppressed' ELSE 'review_required' END,
        lease_token=NULL,lease_expires_at=NULL,provider_inflight=false,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN jsonb_build_object('status',CASE WHEN v_delivery.payload_sha256 IS NULL
      THEN 'suppressed' ELSE 'review_required' END);
  END IF;
  UPDATE public.opportunity_memo_feedback_reminders
    SET status='pending',lease_token=v_token,lease_expires_at=v_now+interval '5 minutes',
      provider_inflight=false,attempt_count=attempt_count+1,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
  RETURN jsonb_build_object('status','claimed','leaseToken',v_token::TEXT);
END $$;

CREATE FUNCTION public.w174_begin_memo_feedback_provider_attempt(
  p_grant_evidence_id UUID,p_lease_token UUID,p_payload_sha256 TEXT,p_expected_payload JSONB
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_match UUID; v_delivery public.opportunity_memo_feedback_reminders%ROWTYPE;
  v_now TIMESTAMPTZ:=clock_timestamp();
BEGIN
  IF p_lease_token IS NULL OR p_expected_payload IS NULL
    OR p_payload_sha256 IS NULL OR p_payload_sha256 !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT match_id INTO v_match FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id;
  IF v_match IS NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.opportunity_matches WHERE id=v_match FOR UPDATE;
  SELECT * INTO v_delivery FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id FOR UPDATE;
  IF v_delivery.status<>'pending' OR v_delivery.lease_token IS DISTINCT FROM p_lease_token
    OR v_delivery.lease_expires_at IS NULL OR v_delivery.lease_expires_at<=v_now THEN RETURN false; END IF;
  IF v_delivery.payload_sha256 IS NOT NULL AND v_delivery.payload_sha256<>p_payload_sha256 THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN false;
  END IF;
  IF public.w174_memo_feedback_delivery_payload(p_grant_evidence_id) IS DISTINCT FROM p_expected_payload THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN false;
  END IF;
  IF v_delivery.provider_outcome IN ('attempting','uncertain')
    AND (v_delivery.provider_attempted_at IS NULL
      OR v_delivery.provider_attempted_at<=v_now-interval '23 hours') THEN
    UPDATE public.opportunity_memo_feedback_reminders
      SET status='review_required',lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
      WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN false;
  END IF;
  UPDATE public.opportunity_memo_feedback_reminders
    SET payload_sha256=COALESCE(payload_sha256,p_payload_sha256),
      template_updated_at=(SELECT updated_at FROM public.email_templates WHERE template_key=v_delivery.template_key),
      provider_attempted_at=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN provider_attempted_at ELSE v_now END,
      provider_outcome=CASE WHEN provider_outcome IN ('attempting','uncertain')
        THEN 'uncertain' ELSE 'attempting' END,provider_inflight=true,updated_at=v_now
    WHERE grant_evidence_id=p_grant_evidence_id;
  RETURN true;
END $$;

CREATE FUNCTION public.w174_complete_memo_feedback_reminder(
  p_grant_evidence_id UUID,p_lease_token UUID,p_outcome TEXT,p_provider_message_id TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_delivery public.opportunity_memo_feedback_reminders%ROWTYPE; v_now TIMESTAMPTZ:=clock_timestamp();
  v_cancelled_after_begin BOOLEAN;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('sent','rejected','uncertain','suppressed','deferred')
    THEN RAISE EXCEPTION 'invalid_delivery_outcome'; END IF;
  IF p_lease_token IS NULL THEN RETURN 'stale'; END IF;
  SELECT * INTO v_delivery FROM public.opportunity_memo_feedback_reminders
    WHERE grant_evidence_id=p_grant_evidence_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_missing'; END IF;
  IF v_delivery.status='sent' THEN RETURN 'sent'; END IF;
  v_cancelled_after_begin:=v_delivery.status='review_required'
    AND v_delivery.provider_inflight
    AND v_delivery.lease_token IS NOT DISTINCT FROM p_lease_token;
  IF NOT ((v_delivery.status='pending' OR v_cancelled_after_begin)
    AND v_delivery.lease_token IS NOT DISTINCT FROM p_lease_token) THEN
    RETURN v_delivery.status;
  END IF;
  IF v_cancelled_after_begin THEN
    IF p_outcome='sent' THEN
      UPDATE public.opportunity_memo_feedback_reminders
        SET status='sent',provider_outcome='accepted',provider_message_id=p_provider_message_id,
          sent_at=v_now,provider_inflight=false,lease_token=NULL,lease_expires_at=NULL,updated_at=v_now
        WHERE grant_evidence_id=p_grant_evidence_id;
      RETURN 'sent';
    END IF;
    UPDATE public.opportunity_memo_feedback_reminders
      SET lease_token=NULL,lease_expires_at=NULL,provider_inflight=false,
        provider_outcome=CASE WHEN provider_outcome='uncertain' OR p_outcome='uncertain'
          THEN 'uncertain' ELSE provider_outcome END,
        updated_at=v_now WHERE grant_evidence_id=p_grant_evidence_id;
    RETURN 'review_required';
  END IF;
  UPDATE public.opportunity_memo_feedback_reminders SET
    status=CASE WHEN p_outcome='sent' THEN 'sent'
      WHEN p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain' THEN 'review_required'
      WHEN p_outcome='suppressed' THEN 'suppressed' ELSE 'failed' END,
    lease_token=NULL,lease_expires_at=NULL,provider_inflight=false,
    provider_outcome=CASE WHEN p_outcome='sent' THEN 'accepted'
      WHEN v_delivery.provider_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='rejected' THEN 'rejected' WHEN p_outcome='uncertain' THEN 'uncertain'
      WHEN p_outcome='deferred' THEN 'deferred' ELSE 'blocked' END,
    provider_attempted_at=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain' THEN NULL ELSE provider_attempted_at END,
    payload_sha256=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain' THEN NULL ELSE payload_sha256 END,
    template_updated_at=CASE WHEN p_outcome IN ('suppressed','deferred')
      AND v_delivery.provider_outcome IS DISTINCT FROM 'uncertain' THEN NULL ELSE template_updated_at END,
    provider_message_id=CASE WHEN p_outcome='sent' THEN p_provider_message_id ELSE provider_message_id END,
    sent_at=CASE WHEN p_outcome='sent' THEN v_now ELSE sent_at END,updated_at=v_now
    WHERE grant_evidence_id=p_grant_evidence_id;
  IF p_outcome='suppressed' AND v_delivery.provider_outcome='uncertain' THEN RETURN 'review_required'; END IF;
  RETURN p_outcome;
END $$;

REVOKE ALL ON FUNCTION public.w174_record_memo_feedback_reminder(),
  public.w174_grant_is_current(UUID),public.w174_record_memo_feedback(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ),
  public.w174_memo_feedback_delivery_payload(UUID),public.w174_claim_memo_feedback_reminder(UUID),
  public.w174_begin_memo_feedback_provider_attempt(UUID,UUID,TEXT,JSONB),
  public.w174_complete_memo_feedback_reminder(UUID,UUID,TEXT,TEXT)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.w174_grant_is_current(UUID),
  public.w174_record_memo_feedback(UUID,UUID,TEXT,TEXT,TIMESTAMPTZ),
  public.w174_memo_feedback_delivery_payload(UUID),public.w174_claim_memo_feedback_reminder(UUID),
  public.w174_begin_memo_feedback_provider_attempt(UUID,UUID,TEXT,JSONB),
  public.w174_complete_memo_feedback_reminder(UUID,UUID,TEXT,TEXT) TO service_role;
